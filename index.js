const koa=require('koa')
// server/index.js
const Koa = require('koa');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const userRouter = require('./routes/user');
const koaBody=require('koa-body').default
const uploadRouter=require('./routes/file');
const app = new Koa();

// 添加 CORS 中间件
app.use(cors({
    origin: '*', 
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

app.use(bodyParser());
app.use(koaBody({
  multipart:true,
  formidable:{
     maxFileSize: 200*1024*1024
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

app.listen(3000, '192.168.124.55', () => {
    console.log('服务器已启动：http:// 192.168.124.55:3000');
});
