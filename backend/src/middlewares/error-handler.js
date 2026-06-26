export function errorHandler(err, req, res, next) {
  console.error(`❌ Error caught by Express middleware:`, err);

  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export default errorHandler;
