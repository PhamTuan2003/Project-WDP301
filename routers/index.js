const yachtRouter = require("./yachtRouter");
const roomRouter = require("./roomRouter");
const companyRouter = require("./companyRouter");
const accountRouter = require("./accountRouter");
const customerRouter = require("./customerRouter");
const bookingRouter = require("./bookingRouter");
const paymentRouter = require("./paymentRouter");
const invoiceRouter = require("./invoiceRouter");
const feedbackRouter = require("./feedbackRouter");
const serviceRouter = require("./serviceRouter");
const adminRouter = require("./adminRouter");
const yachtImageRouter = require("./yachtImageRouter");
const locationRouter = require("./locationRouter");
const yachtTypeRouter = require("./yachtTypeRouter");

module.exports = (app) => {
  const api = "/api/v1";
  app.use(api + "/yachts", yachtRouter);
  app.use(api + "/rooms", roomRouter);
  app.use(api + "/companies", companyRouter);
  app.use(api + "/accounts", accountRouter);
  app.use(api + "/customers", customerRouter);
  app.use(api + "/bookings", bookingRouter);
  app.use(api + "/payments", paymentRouter);
  app.use(api + "/invoices", invoiceRouter);
  app.use(api + "/feedback", feedbackRouter);
  app.use(api + "/services", serviceRouter);
  app.use(api + "/locations", locationRouter);
  app.use(api + "/yachtTypes", yachtTypeRouter);
  app.use(api + "/yachtImages", yachtImageRouter);
  app.use("/admin", adminRouter);
};

module.exports = (app) => {
    const api = "/api";
    app.use(api + '/companies/yacht', yachtRouter)
    app.use(api + '/rooms', roomRouter)
    app.use(api + '/company', companyRouter)
    app.use(api + '/companies', locationRouter)
    app.use(api + '/companies', yachtTypeRouter)
    app.use(api + '/', serviceRouter)
    app.use(api + "/yachtImages", yachtImageRouter);
    app.use(api + "/customers", customerRouter);
}
