const express = require('express');
const {createRoom, createRoomType} = require('../controller/roomController');
const router = express.Router();
const {upload} = require('../utils/configClound')

router.post('/room/create', upload.single('avatar'), createRoom);
router.post('/roomtype/create', createRoomType);



module.exports = router;