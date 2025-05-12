const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Restaurant Management API',
      version: '1.0.0',
      description: 'API documentation for the Restaurant Management system',
    },
    servers: [
      {
        url: 'http://localhost:9999',
      },
    ],
  },
  apis: ['./routes/*.js'], // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};