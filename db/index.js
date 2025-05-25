const mysql=require('mysql2/promise')
// 连接数据库
const pool=mysql.createPool({
    host:'localhost',
    user:'root',
    password:'123456',
    database:'file_system'
});
module.exports=pool