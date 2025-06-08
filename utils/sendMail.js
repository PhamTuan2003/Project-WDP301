const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Hàm gửi email xác nhận đặt phòng (Đặt lịch)
async function sendBookingConfirmationEmail(
  to,
  fullName,
  bookingCode,
  checkInDate,
  guestCount,
  totalPrice,
  options = {}
) {
  if (!to || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(to)) {
    throw new Error("Email không hợp lệ hoặc không tìm thấy email.");
  }
  const subject = "Xác nhận đặt phòng du thuyền";
  const text = `Cảm ơn ${fullName} đã đặt phòng. Mã booking của bạn là: ${bookingCode}`;
  const yachtName = options.yachtName || "";
  const roomListHtml = options.roomListHtml || "";
  const requirements = options.requirements || "";
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8" /><title>Xác nhận đặt phòng du thuyền</title></head>
      <body style="font-family: Arial, sans-serif; background: #f6f8fa; margin:0; padding:0;">
        <table width="100%" bgcolor="#f6f8fa" cellpadding="0" cellspacing="0"><tr><td>
          <table align="center" width="600" style="background: #fff; border-radius: 10px; margin: 40px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <tr><td style="background: #14b8a6; color: #fff; padding: 24px 32px; border-radius: 10px 10px 0 0; text-align: center;"><h2 style="margin: 0;">XÁC NHẬN ĐẶT PHÒNG DU THUYỀN</h2></td></tr>
            <tr><td style="padding: 32px;">
              <p>Xin chào <b>${fullName}</b>,</p>
              <p>Cảm ơn bạn đã <b>đặt phòng du thuyền</b> tại <b>WDP Yacht</b>!</p>
              <table style="width:100%; margin: 24px 0; background: #f0fdfa; border-radius: 8px;"><tr><td style="padding: 12px 16px;">
                <b>Mã booking:</b> <span style="color:#14b8a6;">${bookingCode}</span><br/>
                <b>Tên du thuyền:</b> ${yachtName}<br/>
                <b>Ngày nhận phòng:</b> ${checkInDate}<br/>
                <b>Số khách:</b> ${guestCount}<br/>
                <b>Tổng tiền:</b> ${totalPrice} VNĐ<br/>
                <b>Phòng đã đặt:</b> ${roomListHtml}
                <b>Yêu cầu đặc biệt:</b> ${requirements}
              </td></tr></table>
              <p>Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua email này hoặc số hotline <b>0123 456 789</b>.</p>
              <p style="margin-top: 32px;">Trân trọng,<br/>Đội ngũ WDP Yacht</p>
            </td></tr>
            <tr><td style="background: #f0fdfa; color: #888; padding: 16px 32px; border-radius: 0 0 10px 10px; text-align: center; font-size: 13px;">© 2024 WDP Yacht. All rights reserved.</td></tr>
          </table>
        </td></tr></table>
      </body>
    </html>
  `;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  };
  return transporter.sendMail(mailOptions);
}

// Hàm gửi email xác nhận đăng ký tư vấn
async function sendConsultationEmail(
  to,
  fullName,
  bookingCode,
  checkInDate,
  guestCount,
  requirements
) {
  if (!to || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(to)) {
    throw new Error("Email không hợp lệ hoặc không tìm thấy email.");
  }
  const subject = "Xác nhận đăng ký tư vấn du thuyền";
  const text = `Cảm ơn ${fullName} đã đăng ký tư vấn. Mã yêu cầu của bạn là: ${bookingCode}`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8" /><title>Xác nhận đăng ký tư vấn du thuyền</title></head>
      <body style="font-family: Arial, sans-serif; background: #f6f8fa; margin:0; padding:0;">
        <table width="100%" bgcolor="#f6f8fa" cellpadding="0" cellspacing="0"><tr><td>
          <table align="center" width="600" style="background: #fff; border-radius: 10px; margin: 40px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <tr><td style="background: #f59e42; color: #fff; padding: 24px 32px; border-radius: 10px 10px 0 0; text-align: center;"><h2 style="margin: 0;">XÁC NHẬN ĐĂNG KÝ TƯ VẤN DU THUYỀN</h2></td></tr>
            <tr><td style="padding: 32px;">
              <p>Xin chào <b>${fullName}</b>,</p>
              <p>Bạn đã <b>đăng ký tư vấn du thuyền</b> thành công tại <b>WDP Yacht</b>!</p>
              <table style="width:100%; margin: 24px 0; background: #fff7ed; border-radius: 8px;"><tr><td style="padding: 12px 16px;">
                <b>Mã yêu cầu:</b> <span style="color:#f59e42;">${bookingCode}</span><br/>
                <b>Ngày mong muốn nhận phòng:</b> ${checkInDate}<br/>
                <b>Số khách dự kiến:</b> ${guestCount}<br/>
                <b>Yêu cầu đặc biệt:</b> ${requirements || "Không có"}<br/>
              </td></tr></table>
              <p>Chúng tôi sẽ liên hệ lại với bạn trong thời gian sớm nhất để tư vấn chi tiết.</p>
              <p style="margin-top: 32px;">Trân trọng,<br/>Đội ngũ WDP Yacht</p>
            </td></tr>
            <tr><td style="background: #fff7ed; color: #888; padding: 16px 32px; border-radius: 0 0 10px 10px; text-align: center; font-size: 13px;">© 2024 WDP Yacht. All rights reserved.</td></tr>
          </table>
        </td></tr></table>
      </body>
    </html>
  `;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  };
  return transporter.sendMail(mailOptions);
}

// Hàm test gửi email đơn giản
async function testSendMail(to) {
  if (!to || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(to)) {
    throw new Error("Email không hợp lệ hoặc không tìm thấy email.");
  }
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: "Test Nodemailer",
    text: "Đây là email test gửi từ hệ thống Nodemailer!",
    html: "<b>Đây là email test gửi từ hệ thống Nodemailer!</b>",
  };
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendBookingConfirmationEmail,
  sendConsultationEmail,
  testSendMail,
};
