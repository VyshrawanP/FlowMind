document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const apiUrlInput = document.getElementById('apiUrl');
  const reporterSelect = document.getElementById('reporterUser');
  const configPanel = document.getElementById('configPanel');
  const toggleConfigBtn = document.getElementById('toggleConfig');
  const saveConfigBtn = document.getElementById('saveConfig');

  const boardSelect = document.getElementById('boardSelect');
  const columnSelect = document.getElementById('columnSelect');
  const cardTitleInput = document.getElementById('cardTitle');
  const cardDescInput = document.getElementById('cardDesc');
  const assigneeSelect = document.getElementById('assigneeSelect');
  const complexitySelect = document.getElementById('complexitySelect');
  const sourceUrlDisplay = document.getElementById('sourceUrlDisplay');
  
  const submitBtn = document.getElementById('submitBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');
  const statusMessage = document.getElementById('statusMessage');

  let currentTab = null;
  let allUsers = [];
  let currentApiUrl = 'http://localhost:3001';

  // Toggle config panel
  toggleConfigBtn.addEventListener('click', () => {
    const isVisible = configPanel.style.display === 'block';
    configPanel.style.display = isVisible ? 'none' : 'block';
  });

  // Save config
  saveConfigBtn.addEventListener('click', async () => {
    const newUrl = apiUrlInput.value.trim().replace(/\/$/, '');
    const reporterId = reporterSelect.value;
    
    await chrome.storage.local.set({
      apiUrl: newUrl,
      reporterUserId: reporterId
    });

    currentApiUrl = newUrl;
    configPanel.style.display = 'none';
    showStatus('Settings saved. Refreshing board details...', 'info');
    
    // Reload boards and users
    loadBoardsAndUsers();
  });

  // Initialize
  async function init() {
    // 1. Get current tab URL and title
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        currentTab = tabs[0];
        sourceUrlDisplay.textContent = currentTab.url;
        // Prefill title with tab title
        cardTitleInput.value = currentTab.title;
      }
    } catch (e) {
      console.error('Failed to query active tab:', e);
      sourceUrlDisplay.textContent = 'Unable to fetch tab details';
    }

    // 2. Prefill description from highlighted text selection
    try {
      const result = await chrome.storage.local.get(['lastSelection', 'apiUrl', 'reporterUserId']);
      
      if (result.lastSelection) {
        cardDescInput.value = result.lastSelection;
        // Clear selection storage so it is consumed
        chrome.storage.local.remove('lastSelection');
      }

      if (result.apiUrl) {
        currentApiUrl = result.apiUrl;
        apiUrlInput.value = currentApiUrl;
      }

      // Start fetching boards and users
      loadBoardsAndUsers(result.reporterUserId);
    } catch (e) {
      console.error('Initialization failed:', e);
      showStatus('Initialization failed. Is the extension configured?', 'error');
    }
  }

  // Load Boards & Users
  async function loadBoardsAndUsers(savedReporterId) {
    try {
      submitBtn.disabled = true;
      
      // Fetch users
      const usersRes = await fetch(`${currentApiUrl}/api/users`);
      if (!usersRes.ok) throw new Error('Could not fetch users list');
      allUsers = await usersRes.json();

      // Populate reporter select and assignee select
      populateUserDropdowns(allUsers, savedReporterId);

      // Fetch boards
      const boardsRes = await fetch(`${currentApiUrl}/api/boards`);
      if (!boardsRes.ok) throw new Error('Could not fetch boards list');
      const boards = await boardsRes.json();

      populateBoardDropdown(boards);
      
      submitBtn.disabled = false;
      hideStatus();
    } catch (e) {
      console.error('Failed fetching core data:', e);
      showStatus(`Connection failure: cannot connect to backend at ${currentApiUrl}`, 'error');
    }
  }

  function populateUserDropdowns(users, savedReporterId) {
    // Reporter Select
    reporterSelect.innerHTML = '';
    if (users.length === 0) {
      reporterSelect.innerHTML = '<option value="">No users found. Create one first!</option>';
    } else {
      users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name || user.email;
        if (user.id === savedReporterId) option.selected = true;
        reporterSelect.appendChild(option);
      });
    }

    // Assignee Select
    assigneeSelect.innerHTML = '<option value="">Unassigned</option>';
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.name || user.email;
      assigneeSelect.appendChild(option);
    });
  }

  function populateBoardDropdown(boards) {
    boardSelect.innerHTML = '<option value="">-- Choose Board --</option>';
    
    if (boards.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No boards found';
      boardSelect.appendChild(option);
      return;
    }

    boards.forEach(board => {
      const option = document.createElement('option');
      option.value = board.id;
      option.textContent = board.name;
      boardSelect.appendChild(option);
    });

    // Reset column dropdown
    columnSelect.innerHTML = '<option value="">Select Board first</option>';
    columnSelect.disabled = true;
  }

  // Handle board change to populate columns
  boardSelect.addEventListener('change', async () => {
    const boardId = boardSelect.value;
    if (!boardId) {
      columnSelect.innerHTML = '<option value="">Select Board first</option>';
      columnSelect.disabled = true;
      return;
    }

    try {
      columnSelect.innerHTML = '<option value="">Loading columns...</option>';
      columnSelect.disabled = true;

      const res = await fetch(`${currentApiUrl}/api/columns?boardId=${boardId}`);
      if (!res.ok) throw new Error('Failed to fetch columns');
      const columns = await res.json();

      columnSelect.innerHTML = '';
      if (columns.length === 0) {
        columnSelect.innerHTML = '<option value="">No columns found</option>';
      } else {
        columns.forEach(col => {
          const option = document.createElement('option');
          option.value = col.id;
          option.textContent = col.name;
          columnSelect.appendChild(option);
        });
        columnSelect.disabled = false;
      }
    } catch (e) {
      console.error('Failed to load columns:', e);
      showStatus('Failed to load columns for selected board.', 'error');
    }
  });

  // Handle submit card creation
  submitBtn.addEventListener('click', async () => {
    const boardId = boardSelect.value;
    const columnId = columnSelect.value;
    const title = cardTitleInput.value.trim();
    const rawDesc = cardDescInput.value.trim();
    const assigneeId = assigneeSelect.value;
    const complexityVal = complexitySelect.value;

    const reporterUserId = reporterSelect.value;
    if (!reporterUserId) {
      showStatus('Settings Alert: Configure "Your Identity" in settings panel.', 'error');
      configPanel.style.display = 'block';
      return;
    }

    if (!boardId || !columnId) {
      showStatus('Validation: Please select both a Board and a Column.', 'error');
      return;
    }

    if (!title) {
      showStatus('Validation: Card Title is required.', 'error');
      return;
    }

    try {
      setLoading(true);
      showStatus('Creating card...', 'info');

      // 1. Fetch column cards to determine the bottom fractional index position
      const cardsRes = await fetch(`${currentApiUrl}/api/cards?columnId=${columnId}`);
      if (!cardsRes.ok) throw new Error('Failed to get existing column cards');
      const cards = await cardsRes.json();
      
      let position = 1000.0;
      if (cards && cards.length > 0) {
        const lastCard = cards[cards.length - 1];
        position = lastCard.position + 1000.0;
      }

      // 2. Prepare description appending Source page reference
      let finalDesc = rawDesc;
      if (currentTab) {
        const sourceLine = `\n\n**Source Reference:** [${currentTab.title}](${currentTab.url})`;
        finalDesc = finalDesc ? `${finalDesc}${sourceLine}` : `Created via FlowMind Clipper.${sourceLine}`;
      }

      // 3. Handle complexity option
      let complexity = null;
      let complexityReason = null;
      
      if (complexityVal === "") {
        // Auto-infer (AI) mode
        try {
          showStatus('AI is analyzing task complexity...', 'info');
          const aiRes = await fetch(`${currentApiUrl}/api/cards/infer-complexity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description: finalDesc })
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            complexity = aiData.complexity;
            complexityReason = aiData.reasoning;
          }
        } catch (e) {
          console.warn('AI complexity inference failed, proceeding without it:', e);
        }
      } else {
        complexity = parseInt(complexityVal);
        complexityReason = "Manually specified via FlowMind Clipper Chrome Extension.";
      }

      // 4. Create card
      showStatus('Saving card to Kanban Board...', 'info');
      const createRes = await fetch(`${currentApiUrl}/api/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: finalDesc,
          position,
          columnId,
          boardId,
          userId: reporterUserId,
          assigneeId: assigneeId || undefined,
          complexity: complexity !== null ? complexity : undefined,
          complexityReason: complexityReason !== null ? complexityReason : undefined
        })
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || 'Failed to create card on board');
      }

      showStatus('🎉 Card successfully added to board!', 'success');
      
      // Reset title and desc fields
      cardTitleInput.value = '';
      cardDescInput.value = '';

      // Auto close extension after success
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (e) {
      console.error(e);
      showStatus(`Error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  });

  // Helpers
  function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = ''; // reset classes
    statusMessage.classList.add(`status-${type}`);
    statusMessage.style.display = 'block';
  }

  function hideStatus() {
    statusMessage.style.display = 'none';
  }

  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      btnSpinner.style.display = 'block';
      btnText.textContent = 'Processing...';
    } else {
      submitBtn.disabled = false;
      btnSpinner.style.display = 'none';
      btnText.textContent = 'Create Kanban Card';
    }
  }

  // Run on load
  init();
});
