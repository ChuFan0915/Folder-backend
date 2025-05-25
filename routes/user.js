const Router=require('koa-router')
const {register,login}=require('../controllers/user')
const router=new Router()
router.post('/register',register)
router.post('/login',login)
module.exports=router