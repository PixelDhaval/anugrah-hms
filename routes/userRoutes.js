const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/auth-login', userController.authUser);

router.get('/', userController.checkAuth, (req, res) => {
    res.render("index");
});

router.get('/index', userController.checkAuth, (req, res) => {
    res.render("index");
});

router.get('/create-users', userController.checkAuth, (req, res) => {
    res.render('create-users');  
});

router.get('/user-authentication', userController.checkAuth, (req, res) => {
    res.render('user-authentication');  
});

router.post('/create-user', userController.createUser);
router.get('/showUsers', userController.showUsers);
router.delete('/delete-user/:id', userController.deleteUser);
router.put('/updateUser', userController.updateUser);
router.put('/changePassword', userController.changePassword);

router.get("/get-user-name", userController.getUserName)
router.get("/logout", userController.logout)
module.exports = router;
