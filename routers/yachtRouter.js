const express = require('express');
const {createYacht} = require('../controller/yachtController');
const router = express.Router();
const {upload} = require('../utils/configClound')


router.post('/yacht', upload.single('image'), createYacht);


module.exports = router;