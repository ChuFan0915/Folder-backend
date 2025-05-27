const Router=require('koa-router')
const {register,login,logout}=require('../controllers/user')
const router=new Router()
router.post('/register',register)
router.post('/login',login)
// 用户登录接口
router.post('/logout',logout)
module.exports=router