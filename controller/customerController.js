const { Customer, Account } = require("../model");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
// const { sendOTP } = require("../utils/mailer");
// const redisClient = require("../utils/redis");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Định nghĩa base URL của server
const BASE_URL = "http://localhost:9999";

// Hàm đăng ký tài khoản khách hàng
const register = async (req, res) => {
  try {
    const { username, email, fullName, phoneNumber, password } = req.body;
    if (!username || !email || !fullName || !phoneNumber || !password) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
    }

    const existing = await Account.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "Tên đăng nhập đã tồn tại, vui lòng dùng tên đăng nhập khác!" });
    }

    // Hash mật khẩu
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    // Tạo tài khoản Account
    const account = await Account.create({
      username,
      password: hashedPassword,
      roles: "CUSTOMER",
      status: 1,
    });

    // Tạo hồ sơ Customer
    const customer = await Customer.create({
      fullName,
      email,
      phoneNumber,
      accountId: account._id,
    });

    res.status(201).json({
      message: "Tạo tài khoản thành công",
      customer: {
        fullName: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        username: account.username,
        avatar: customer.avatar || "null",
      },
    });
  } catch (error) {
    console.error("Đăng ký bị lỗi:", error);
    res.status(500).json({ message: "Lỗi server khi đăng ký, thử lại sau" });
  }
};

// Hàm đăng nhập tài khoản khách hàng
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Hãy điền tên đăng nhập và mật khẩu" });
    }

    const account = await Account.findOne({ username });
    if (!account) {
      console.log(`Không tìm thấy tài khoản với username: ${username}`);
      return res.status(400).json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    const isMatch = await bcryptjs.compare(password, account.password);
    if (!isMatch) {
      console.log(`Mật khẩu không khớp cho username: ${username}`);
      return res.status(400).json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    const customer = await Customer.findOne({ accountId: account._id });
    if (!customer) {
      console.log(`Không tìm thấy khách hàng với accountId: ${account._id}`);
      return res.status(404).json({ message: "Không tìm thấy thông tin khách hàng" });
    }

    const token = jwt.sign({ _id: account._id, role: account.roles }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Nếu avatar tồn tại, thêm BASE_URL vào trước đường dẫn (trừ khi avatar là URL từ Google)
    const avatar = customer.avatar
      ? customer.avatar.startsWith("http")
        ? customer.avatar
        : `${BASE_URL}${customer.avatar}`
      : null;

    res.json({
      message: "Đăng nhập thành công",
      token,
      customer: {
        id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        username: account.username,
        avatar: avatar,
        accountId: customer.accountId,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Lỗi server khi đăng nhập" });
  }
};

// Hàm đăng nhập bằng Google (login with Google)
const googleLogin = async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload; // Lấy thêm trường picture

    let customer = await Customer.findOne({ $or: [{ email }, { googleId }] });
    if (!customer) {
      customer = new Customer({
        email,
        fullName: name,
        googleId,
        phoneNumber: "",
        avatar: picture, // Lưu URL ảnh đại diện từ Google
      });
      await customer.save();
    } else {
      // Cập nhật avatar từ Google nếu chưa có hoặc đã thay đổi
      if (!customer.avatar || customer.avatar !== picture) {
        customer.avatar = picture;
        await customer.save();
      }
    }

    const jwtToken = jwt.sign({ _id: customer._id, role: "CUSTOMER" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      message: "Đăng nhập bằng Google thành công",
      token: jwtToken,
      customer: {
        id: customer._id,
        fullName: customer.fullName,
        username: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        avatar: customer.avatar, // URL từ Google
      },
      requiresPhoneNumber: !customer.phoneNumber,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({ message: "Đăng nhập bằng Google thất bại" });
  }
};

// Hàm quên mật khẩu
// const forgotPassword = async (req, res) => {
//   const { username } = req.body;
//   if (!username) {
//     return res.status(400).json({ message: "Vui lòng nhập username" });
//   }

//   try {
//     const account = await Account.findOne({ username, roles: "CUSTOMER" });
//     if (!account) {
//       return res.status(404).json({ message: "Tài khoản không tồn tại hoặc không phải khách hàng" });
//     }

//     const customer = await Customer.findOne({ accountId: account._id });
//     if (!customer || !customer.email) {
//       return res.status(404).json({ message: "Không tìm thấy email của khách hàng" });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     await redisClient.setEx(`otp:${username}`, 10 * 60, otp);

//     const sent = await sendOTP(customer.email, otp);
//     if (!sent) {
//       return res.status(500).json({ message: "Lỗi gửi email OTP" });
//     }

//     res.status(200).json({ message: "OTP đã được gửi đến email của bạn" });
//   } catch (error) {
//     console.error("Error in forgot-password:", error);
//     res.status(500).json({ message: "Lỗi server" });
//   }
// };

// Hàm xác thực OTP
// const verifyOtp = async (req, res) => {
//   const { username, otp } = req.body;
//   if (!username || !otp) {
//     return res.status(400).json({ message: "Vui lòng nhập username và OTP" });
//   }

//   try {
//     const storedOtp = await redisClient.get(`otp:${username}`);
//     if (!storedOtp || storedOtp !== otp) {
//       return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
//     }

//     await redisClient.del(`otp:${username}`);
//     res.status(200).json({ message: "Xác thực OTP thành công" });
//   } catch (error) {
//     console.error("Error in verify-otp:", error);
//     res.status(500).json({ message: "Lỗi server" });
//   }
// };

// // Hàm đặt lại mật khẩu
// const resetPassword = async (req, res) => {
//   const { username, newPassword } = req.body;
//   if (!username || !newPassword) {
//     return res.status(400).json({ message: "Vui lòng nhập username và mật khẩu mới" });
//   }

//   if (newPassword.length < 6) {
//     return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
//   }

//   try {
//     const account = await Account.findOne({ username, roles: "CUSTOMER" });
//     if (!account) {
//       return res.status(404).json({ message: "Tài khoản không tồn tại hoặc không phải khách hàng" });
//     }

//     account.password = newPassword;
//     await account.save();

//     return res.status(200).json({ message: "Đặt lại mật khẩu thành công" });
//   } catch (error) {
//     console.error("Error in reset-password:", error);
//     return res.status(500).json({ message: "Lỗi server khi đặt lại mật khẩu" });
//   }
// };

// Hàm cập nhật thông tin khách hàng
const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phoneNumber } = req.body;

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    // Kiểm tra nếu tài khoản là Google (có googleId) thì không cho sửa email
    if (customer.googleId && email) {
      return res.status(400).json({ message: "Không thể sửa email cho tài khoản Google" });
    }

    if (fullName) customer.fullName = fullName;
    if (email && !customer.googleId) {
      // Chỉ cập nhật email nếu không phải tài khoản Google
      customer.email = email;
    }
    if (phoneNumber) {
      if (!/^(?:\+84|0)(3[2-9]|5[6-9]|7[0-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(phoneNumber)) {
        return res.status(400).json({ message: "Số điện thoại không hợp lệ (phải bắt đầu bằng 0 hoặc +84, theo sau là đầu số hợp lệ và 7 chữ số)" });
      }
      customer.phoneNumber = phoneNumber;
    }

    await customer.save();

    const avatar = customer.avatar
      ? customer.avatar.startsWith("http")
        ? customer.avatar
        : `${BASE_URL}${customer.avatar}`
      : null;

    res.status(200).json({
      message: "Cập nhật thông tin thành công",
      customer: {
        id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        avatar: avatar,
      },
    });
  } catch (error) {
    console.error("Error in update-customer:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật thông tin khách hàng", error: error.message });
  }
};

// Hàm upload avatar cho khách hàng
const uploadCustomerAvatar = async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng tải lên ảnh avatar" });
    }

    customer.avatar = `/uploads/customer-avatar/${req.file.filename}`;
    await customer.save();

    // Thêm BASE_URL vào trước đường dẫn avatar
    const avatar = customer.avatar ? `${BASE_URL}${customer.avatar}` : null;

    res.status(200).json({
      message: "Upload avatar thành công",
      customer: {
        id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        avatar: avatar,
      },
    });
  } catch (error) {
    console.error("Error in upload-customer-avatar:", error);
    res.status(500).json({ message: "Lỗi server khi upload avatar", error: error.message });
  }
};

// const changePassword = async (req, res) => {
//   const { username, oldPassword, newPassword, confirmPassword } = req.body;

//   if (!username || !oldPassword || !newPassword || !confirmPassword) {
//     return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
//   }

//   if (newPassword !== confirmPassword) {
//     return res.status(400).json({ message: "Mật khẩu mới và xác nhận mật khẩu không khớp" });
//   }

//   if (newPassword.length < 6) {
//     return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
//   }

//   try {
//     const account = await Account.findOne({ username, roles: "CUSTOMER" });
//     if (!account) {
//       return res.status(404).json({ message: "Tài khoản không tồn tại hoặc không phải khách hàng" });
//     }

//     const isMatch = await bcryptjs.compare(oldPassword, account.password);
//     if (!isMatch) {
//       return res.status(400).json({ message: "Mật khẩu cũ không đúng" });
//     }

//     account.password = newPassword;
//     await account.save();

//     res.status(200).json({ message: "Đổi mật khẩu thành công" });
//   } catch (error) {
//     console.error("Error in change-password:", error);
//     res.status(500).json({ message: "Lỗi server khi đổi mật khẩu" });
//   }
// };

module.exports = {
  register,
  login,
  // forgotPassword,
  // verifyOtp,
  // resetPassword,
  googleLogin,
  updateCustomer,
  uploadCustomerAvatar,
  // changePassword,
};