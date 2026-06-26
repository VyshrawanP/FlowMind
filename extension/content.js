// Listen for mouse selections and save them to chrome storage
document.addEventListener('mouseup', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    chrome.storage.local.set({ lastSelection: selectedText });
  }
});
