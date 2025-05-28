const Router=require('koa-router')
const uploadFiles=require('../controllers/upload')
const getfileList=require('../controllers/upload')
const downloadFile=require('../controllers/upload')
const DeleteFile=require('../controllers/upload')
const renameFile=require('../controllers/upload')
const bigFileUpload = require('../controllers/bigFileUpload')
const router=new Router()
// 编写接口
router.post('/uploads',uploadFiles.uploadFiles)
// 上传文件
router.get('/getfileList',getfileList.getfileList)
// 文件展示
router.get('/downloadFile/:id',downloadFile.downloadfile)
// 文件下载
router.post('/deletefile/:id',DeleteFile.DeleteFile)
// 文件删除
router.post('/renameFile/:id',renameFile.renameFile)
// 大文件上传接口展示：
router.get('/verify', bigFileUpload.Isuploads)
router.get('/verifyChunk', bigFileUpload.verifyChunk)
router.post('/uploadChunk', bigFileUpload.uploadChunk)
router.post('/mergeChunks', bigFileUpload.mergeChunks)
router.delete('/cleanChunks', bigFileUpload.cleanChunks)

module.exports=router