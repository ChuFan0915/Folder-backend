const fs=require('fs')
const path=require('path')
const pool=require('../db')
exports.uploadFiles=async(ctx)=>{
    try{
        const file=ctx.request.files.file
        // 获取上传的文件
        const {originalFilename, size, mimetype, filepath} = file
        // 通过解构拿到文件的信息
         const uploadDir = path.join(__dirname, '../uploads')
        //  新建一个存储路径
        const fileName=`${Date.now()}--${originalFilename}`
        const filePath=path.join(uploadDir,fileName)
         // 移动文件
        const reader = fs.createReadStream(filepath)
        const writer = fs.createWriteStream(filePath)
        reader.pipe(writer)
        // 保存文件信息到数据库
             const [result] = await pool.query(
            'INSERT INTO files (filename, path, size, mimetype) VALUES (?, ?, ?, ?)',
            [originalFilename, fileName, size, mimetype]
        )
        ctx.body={
            code:0,
            message:'上传成功',
            data:{
                id: result.insertId,
                fileName: originalFilename,
                fileSize: size,
                fileType: mimetype
            }
        }
    }catch(e){
        console.error('上传错误：', e)
        ctx.body={
            code:1,
            message:'上传失败，服务器出了差错'
        },
        console.log(e);
        
    }
}
exports.getfileList=async(ctx)=>{
    try{
          const [rows] = await pool.query(
            'SELECT id, filename, path, size, mimetype, upload_time FROM files ORDER BY upload_time DESC'
        )
        ctx.body={
            code:0,
            message:'获取成功',
            data:rows
        }
    }catch(e){
        ctx.body={
            code:1,
            message:'获取失败，请稍后再试',
        }
        console.log(e);
        
    }
}
exports.downloadfile=async(ctx)=>{
    try{
        const {id}=ctx.params
        // 从数据库获取到文件信息
           const [rows] = await pool.query(
            'SELECT filename, path FROM files WHERE id = ?',
            [id]
        )
        const file=rows[0]
        const filepath=path.join(__dirname,'../uploads',file.path)
        // 设置响应头
        ctx.set('Content-Type', 'application/octet-stream')
        ctx.set('Content-Disposition', `attachment; filename=${encodeURIComponent(file.filename)}`)
        const fileStream=fs.createReadStream(filepath)
        ctx.body=fileStream
    }catch(e){
        ctx.body={
            code:1,
            message:'下载错误，服务器出了问题'
        }
        console.log(e);
        
    
}
}