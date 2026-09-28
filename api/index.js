// Punto de entrada para Vercel: sirve la web exportada (dist/client) y las rutas /api de Expo Router
// (dist/server). Ver https://docs.expo.dev/router/web/api-routes/ (sección Vercel).
const { createRequestHandler } = require("expo-server/adapter/vercel");

module.exports = createRequestHandler({
  build: require("path").join(__dirname, "../dist/server"),
});
