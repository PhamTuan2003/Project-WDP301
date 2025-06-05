const yachtRouter = require('./yachtRouter');
const roomRouter = require('./roomRouter');
const companyRouter = require('./companyRouter');

module.exports = (app) => {
    const api = "/api";
    app.use(api + '/yacht', yachtRouter)
    app.use(api + '/rooms', roomRouter)
    app.use(api + '/company', companyRouter)
}
