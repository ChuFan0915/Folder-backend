const pool=require('../db')
const bcrypt=require('bcryptjs')
exports.register=async(ctx)=>{
    const {username,password}=ctx.request.body;
    if(!username||!password){
        ctx.body={code:1,message:'用户或账户密码不能为空'}
        return;
    }
    try{
        const [rows]=await pool.query('SELECT*FROM users WHERE username=?',[username]);
        if(rows.length>0){
            ctx.body={code:1,message:'该用户已存在，请重新注册'}
            return ;
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        await pool.query('INSERT INTO users(username,password) VALUES(?,?)',[username,hashedPassword])
        ctx.body={code:0,message:'注册成功'}
        
    }catch(e){
        console.error('注册错误：', e)
        ctx.body={code:1,message:'注册失败，服务器出了差错'}
        
    }
}
exports.login=async(ctx)=>{
    const {username,password}=ctx.request.body
    if(!username||!password){
        ctx.body={code:1,message:'请输入账户密码'}
        return;
    }
    if(username=='test'&&password=='123456'){
         ctx.body={code:1,message:'用户密码不对，请重新输入'}
            return
    }
    try{
        const [rows]=await pool.query('SELECT*FROM users WHERE username=?',[username])
        if(rows.length===0){
            ctx.body={code:1,message:'用户账户不对，请检查重新输入'}
            return
        }
        const user=rows[0]
        const isPasswordValid=await bcrypt.compare(password,user.password)
        if(!isPasswordValid){
            ctx.body={code:1,message:'用户密码不对，请重新输入'}
            return
        }else{
            ctx.body={code:0,message:'登录成功'}
        }
        
    }catch(e){
        console.error('登录错误：', e)
        ctx.body={code:1,message:'登录失败，服务器出了差错'}
    }
}