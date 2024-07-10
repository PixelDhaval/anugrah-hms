// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/create-users', (req, res) => {
    res.render('create-users');  
});

router.get('/user-authentication', (req, res) => {
    res.render('user-authentication');  
});

router.post('/create-user', userController.createUser);
router.get('/showUsers', userController.showUsers);
router.delete('/delete-user/:id', userController.deleteUser);
router.put('/updateUser', userController.updateUser);
router.put('/changePassword', userController.changePassword);

module.exports = router;
