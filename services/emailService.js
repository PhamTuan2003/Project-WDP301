const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'burestaurantsieuvippro@gmail.com',
    pass: 'jxun mszo ecls mltf'  
  }
});

const sendEmail = async (to, subject, htmlContent, text) => {
  const mailOptions = {
    from: '"Nhà Hàng Bu Restaurant" <burestaurantsieuvippro@gmail.com>',
    to,
    subject,
    html: htmlContent,
    text: text || htmlContent.replace(/<[^>]*>/g, ''), 
    headers: {
      'Precedence': 'bulk',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'List-Unsubscribe': '<mailto:burestaurantsieuvippro@gmail.com?subject=Unsubscribe>'
    }
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};


const createWelcomeEmail = (name, email, tempPassword) => {
  return {
    subject: 'Chào mừng đến với Bu Restaurant - Thông tin đặt bàn của bạn',
    html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chào mừng đến với Bu Restaurant</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          background-color: #f8f9fa;
          padding: 15px;
          text-align: center;
          border-bottom: 2px solid #4a6da7;
        }
        .content {
          padding: 20px 0;
        }
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }
        .info-box {
          background-color: #f8f9fa;
          padding: 15px;
          border-left: 4px solid #4a6da7;
          margin: 15px 0;
        }
        h1 {
          color: #4a6da7;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #4a6da7;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Bu Restaurant</h1>
        </div>
        <div class="content">
          <p>Xin chào <strong>${name}</strong>,</p>
          
          <p>Cảm ơn bạn đã đặt bàn tại Bu Restaurant. Chúng tôi rất mong được phục vụ bạn!</p>
          
          <div class="info-box">
            <p><strong>Thông tin đăng nhập hệ thống của bạn:</strong></p>
            <p>Email đăng nhập: ${email}</p>
            <p>Mã truy cập: ${tempPassword}</p>
          </div>
          
          <p>Với tài khoản này, bạn có thể:</p>
          <ul>
            <li>Theo dõi lịch sử đặt bàn</li>
            <li>Nhận thông báo về các ưu đãi đặc biệt</li>
            <li>Đặt bàn dễ dàng hơn trong lần tới</li>
          </ul>
          
          <p>Vui lòng đổi mã truy cập của bạn khi đăng nhập lần đầu tiên để đảm bảo an toàn.</p>
          
          <p>Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi qua email này hoặc gọi số <strong>0904628569</strong>.</p>
          
          <p>Trân trọng,<br>
          <strong>Bu Restaurant</strong></p>
        </div>
        <div class="footer">
          <p>© 2025 Bu Restaurant. Tất cả quyền được bảo lưu.</p>
          <p>Email này được gửi tự động.</p>
          <p>Để hủy đăng ký nhận email, vui lòng <a href="mailto:burestaurantsieuvippro@gmail.com?subject=Unsubscribe">nhấn vào đây</a>.</p>
        </div>
      </div>
    </body>
    </html>
    `,
    text: `
    Xin chào ${name},

    Cảm ơn bạn đã đặt bàn tại Bu Restaurant. Chúng tôi rất mong được phục vụ bạn!

    THÔNG TIN ĐĂNG NHẬP HỆ THỐNG CỦA BẠN:
    Email đăng nhập: ${email}
    Mã truy cập: ${tempPassword}

    Với tài khoản này, bạn có thể:
    - Theo dõi lịch sử đặt bàn
    - Nhận thông báo về các ưu đãi đặc biệt
    - Đặt bàn dễ dàng hơn trong lần tới

    Vui lòng đổi mã truy cập của bạn khi đăng nhập lần đầu tiên để đảm bảo an toàn.

    Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi qua email này hoặc gọi số 0904628569.

    Trân trọng,
    Bu Restaurant

    © 2025 Bu Restaurant. Tất cả quyền được bảo lưu.
    Email này được gửi tự động.
    Để hủy đăng ký nhận email, vui lòng gửi email đến burestaurantsieuvippro@gmail.com với chủ đề "Unsubscribe".
    `
  };
};

const createReservationConfirmation = (name, reservationCode, date, time, tableNumbers, guests) => {
  const formattedDate = new Date(date).toLocaleDateString('vi-VN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return {
    subject: `Xác nhận đặt bàn #${reservationCode} - Bu Restaurant`,
    html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Xác nhận đặt bàn - Bu Restaurant</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          background-color: #f8f9fa;
          padding: 15px;
          text-align: center;
          border-bottom: 2px solid #4a6da7;
        }
        .content {
          padding: 20px 0;
        }
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }
        .reservation-details {
          background-color: #f8f9fa;
          padding: 15px;
          border-left: 4px solid #4a6da7;
          margin: 15px 0;
        }
        h1 {
          color: #4a6da7;
        }
        .qr-placeholder {
          width: 150px;
          height: 150px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Bu Restaurant - Xác nhận đặt bàn</h1>
        </div>
        <div class="content">
          <p>Xin chào <strong>${name}</strong>,</p>
          
          <p>Cảm ơn bạn đã đặt bàn tại Bu Restaurant. Đơn đặt bàn của bạn đã được xác nhận!</p>
          
          <div class="reservation-details">
            <p><strong>Chi tiết đặt bàn:</strong></p>
            <p>Mã đặt bàn: <strong>${reservationCode}</strong></p>
            <p>Ngày: ${formattedDate}</p>
            <p>Thời gian: ${time}</p>
            <p>Số bàn: ${tableNumbers}</p>
            <p>Số khách: ${guests} người</p>
          </div>
          
          <p>Vui lòng giữ thông tin này và xuất trình khi đến nhà hàng.</p>
          
          <p><strong>Lưu ý:</strong></p>
          <ul>
            <li>Đặt bàn của bạn sẽ được giữ trong vòng 15 phút sau giờ đặt</li>
            <li>Nếu bạn muốn hủy hoặc thay đổi đặt bàn, vui lòng liên hệ với chúng tôi trước 2 giờ</li>
          </ul>
          
          <p>Chúng tôi rất mong được phục vụ bạn tại Bu Restaurant!</p>
          
          <p>Trân trọng,<br>
          <strong>Bu Restaurant</strong></p>
        </div>
        <div class="footer">
          <p>© 2025 Bu Restaurant. Tất cả quyền được bảo lưu.</p>
          <p>Email này được gửi tự động.</p>
          <p>Để hủy đăng ký nhận email, vui lòng <a href="mailto:burestaurantsieuvippro@gmail.com?subject=Unsubscribe">nhấn vào đây</a>.</p>
        </div>
      </div>
    </body>
    </html>
    `,
    text: `
    Xin chào ${name},

    Cảm ơn bạn đã đặt bàn tại Bu Restaurant. Đơn đặt bàn của bạn đã được xác nhận!

    CHI TIẾT ĐẶT BÀN:
    Mã đặt bàn: ${reservationCode}
    Ngày: ${formattedDate}
    Thời gian: ${time}
    Số bàn: ${tableNumbers}
    Số khách: ${guests} người

    Vui lòng giữ thông tin này và xuất trình khi đến nhà hàng.

    LƯU Ý:
    - Đặt bàn của bạn sẽ được giữ trong vòng 15 phút sau giờ đặt
    - Nếu bạn muốn hủy hoặc thay đổi đặt bàn, vui lòng liên hệ với chúng tôi trước 2 giờ

    Chúng tôi rất mong được phục vụ bạn tại Bu Restaurant!

    Trân trọng,
    Bu Restaurant

    © 2025 Bu Restaurant. Tất cả quyền được bảo lưu.
    Email này được gửi tự động.
    Để hủy đăng ký nhận email, vui lòng gửi email đến burestaurantsieuvippro@gmail.com với chủ đề "Unsubscribe".
    `
  };
};

module.exports = {
  sendEmail,
  createWelcomeEmail,
  createReservationConfirmation
};