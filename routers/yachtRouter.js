const express = require('express');
const {createYacht, addServiceToYacht, addScheduleToYacht} = require('../controller/yachtController');
const router = express.Router();
const {upload} = require('../utils/configClound')


router.post('/create', upload.single('image'), createYacht);
router.post('/add-service', addServiceToYacht);
router.post('/add-schedule', addScheduleToYacht);


module.exports = router;