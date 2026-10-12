const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const dashboardController = require('../controllers/dashboardController');

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

router.get('/dashboard-data', userController.checkAuth, dashboardController.getDashboardData);

router.get('/create-users', userController.checkAuth, (req, res) => {
    res.render('create-users');  
});

router.get('/user-authentication', userController.checkAuth, (req, res) => {
    res.render('user-authentication');  
});

router.post('/create-user', userController.checkAuth, userController.createUser);
router.get('/showUsers', userController.checkAuth, userController.showUsers);
router.delete('/delete-user/:id', userController.checkAuth, userController.deleteUser);
router.put('/updateUser', userController.checkAuth, userController.updateUser);
router.put('/changePassword', userController.checkAuth, userController.changePassword);

router.get("/get-user-name", userController.getUserName)
router.get("/logout", userController.logout)
module.exports = router;
