import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Minimal health check
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Unami Foundation Moments API',
    version: '1.0.0'
  });
});

// Catch all
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Minimal server running on port ${PORT}`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;