
// server/index.js
const Koa = require('koa');
const cors = require('@koa/cors');

const userRouter = require('./routes/user');
const koaBody=require('koa-body').default
const uploadRouter=require('./routes/file');
const app = new Koa();
const fs=require('fs')
const path=require('path')

// 添加 CORS 中间件
app.use(cors({
    origin: '*', 
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));


app.use(koaBody({
  multipart:true,
  formidable:{
     maxFileSize: 5*1024*1024*1024,
    //  实现大文件上传的临时切片分片
    keepExtensions:true,
    // 设置临时文件目录
    uploadDir:path.join(__dirname,'uploads/temp'),
    // 创建临时目录
    onFileBegin:(name,file)=>{
        const uploadDir=path.join(__dirname,'uploads/temp')
       if(!fs.existsSync(uploadDir)){
        // 如果临时不存在，我们就要自己新建一个
        fs.mkdirSync(uploadDir,{recursive:true})
       }
    }

  }
}))
app.use(userRouter.routes()).use(userRouter.allowedMethods());
app.use(uploadRouter.routes()).use(uploadRouter.allowedMethods());

// 添加错误处理中间件
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        console.error('服务器错误：', err);
        ctx.status = err.status || 500;
        ctx.body = {
            code: 1,
            message: err.message || '服务器内部错误'
        };
    }
});

app.listen(3000, '192.168.1.244', () => {
    console.log('服务器已启动：http://192.168.1.244:3000');
});
