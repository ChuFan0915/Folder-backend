const path = require('path')
const fs = require('fs')
const pool = require('../db')
// 验证文件是否已上传（秒传）
exports.Isuploads = async (ctx) => {
    try {
        const { hash } = ctx.query;
        // 先检查数据库是否存在 file_hash 字段
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'files' 
            AND COLUMN_NAME = 'file_hash'
        `);

        // 如果不存在 file_hash 字段，添加该字段
        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE files
                ADD COLUMN file_hash VARCHAR(255) AFTER mimetype
            `);
        }

        // 查询文件是否存在
        const [rows] = await pool.query(
            "SELECT id FROM files WHERE file_hash = ?",
            [hash]
        );
        ctx.body = {
            code: 0,
            data: {
                exists: rows.length > 0,
                fileId: rows.length > 0 ? rows[0].id : null
            }
        };
    } catch (e) {
        console.error("验证文件失败：", e);
        ctx.body = { code: 1, message: "验证失败" };
    }
}

// 验证分片是否已上传
exports.verifyChunk = async (ctx) => {
    try {
        const { hash, chunkIndex } = ctx.query;
        const chunkDir = path.join(__dirname, '../uploads/chunks', hash);
        const chunkPath = path.join(chunkDir, `${chunkIndex}`);

        ctx.body = {
            code: 0,
            data: {
                exists: fs.existsSync(chunkPath)
            }
        };
    } catch (e) {
        console.error("验证分片失败：", e);
        ctx.body = { code: 1, message: "分片验证失败" };
    }
}

// 上传分片
exports.uploadChunk = async (ctx) => {
    try {
        const { hash, chunkIndex, totalChunks } = ctx.request.body;
        const chunk = ctx.request.files.chunk;

        // 创建分片存储目录
        const chunkDir = path.join(__dirname, '../uploads/chunks', hash);
        if (!fs.existsSync(chunkDir)) {
            fs.mkdirSync(chunkDir, { recursive: true });
        }

        // 保存分片
        const chunkPath = path.join(chunkDir, `${chunkIndex}`);
        const reader = fs.createReadStream(chunk.filepath);
        const writer = fs.createWriteStream(chunkPath);

        await new Promise((resolve, reject) => {
            reader.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 删除临时文件
        fs.unlink(chunk.filepath, (err) => {
            if (err) console.error('临时文件删除失败:', err);
        });

        ctx.body = {
            code: 0,
            message: "分片上传成功",
            data: { chunkIndex }
        };
    } catch (e) {
        console.error("上传分片失败：", e);
        ctx.body = { code: 1, message: "分片上传失败" };
    }
}

// 合并分片
exports.mergeChunks = async (ctx) => {
    try {
        const { hash, filename, totalChunks, size, mimetype } = ctx.request.body;
        const chunkDir = path.join(__dirname, '../uploads/chunks', hash);
        const uploadDir = path.join(__dirname, '../uploads');

        // 1. 首先验证所有分片是否都已上传
        const validateChunks = async () => {
            const existingChunks = [];
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = path.join(chunkDir, `${i}`);
                if (fs.existsSync(chunkPath)) {
                    existingChunks.push(i);
                }
            }
            return {
                isComplete: existingChunks.length === totalChunks,
                existingChunks,
                missingChunks: Array.from({ length: totalChunks }, (_, i) => i)
                    .filter(i => !existingChunks.includes(i))
            };
        };

        // 2. 验证分片完整性
        const validation = await validateChunks();
        if (!validation.isComplete) {
            ctx.body = {
                code: 1,
                message: "文件分片不完整",
                data: {
                    missingChunks: validation.missingChunks
                }
            };
            return;
        }

        // 3. 确保上传目录存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 4. 生成最终文件名
        const fileName = `${Date.now()}--${filename}`;
        const filePath = path.join(uploadDir, fileName);

        // 5. 创建写入流
        const writeStream = fs.createWriteStream(filePath);

        // 6. 按顺序合并分片
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(chunkDir, `${i}`);
            try {
                await new Promise((resolve, reject) => {
                    const readStream = fs.createReadStream(chunkPath);
                    readStream.pipe(writeStream, { end: false });
                    readStream.on('end', resolve);
                    readStream.on('error', (err) => {
                        console.error(`读取分片 ${i} 失败:`, err);
                        reject(err);
                    });
                });
            } catch (error) {
                console.error(`处理分片 ${i} 时出错:`, error);
                throw new Error(`处理分片 ${i} 失败: ${error.message}`);
            }
        }

        // 7. 结束写入流
        writeStream.end();

        // 8. 等待文件写入完成
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // 9. 验证最终文件大小
        const finalSize = fs.statSync(filePath).size;
        if (finalSize !== parseInt(size)) {
            throw new Error(`文件大小不匹配: 预期 ${size} 字节, 实际 ${finalSize} 字节`);
        }

        try {
            // 10. 保存到数据库
            const [result] = await pool.query(
                "INSERT INTO files (filename, path, size, mimetype, file_hash) VALUES (?, ?, ?, ?, ?)",
                [filename, fileName, size, mimetype, hash]
            );

            // 11. 清理分片目录
            fs.rm(chunkDir, { recursive: true }, (err) => {
                if (err) console.error('清理分片目录失败:', err);
            });

            ctx.body = {
                code: 0,
                message: "文件合并成功",
                data: {
                    id: result.insertId,
                    fileName: filename,
                    fileSize: size,
                    fileType: mimetype
                }
            };
        } catch (dbError) {
            // 数据库错误处理
            console.error("数据库操作失败:", dbError);
            // 清理已合并的文件
            fs.unlink(filePath, () => {});
            throw dbError;
        }
    } catch (e) {
        console.error("合并文件失败：", e);
        ctx.body = {
            code: 1,
            message: "文件合并失败",
            error: e.message,
            details: e.stack
        };
    }
};

// 清理分片
exports.cleanChunks = async (ctx) => {
    try {
        const { hash } = ctx.query;
        const chunkDir = path.join(__dirname, '../uploads/chunks', hash);

        if (fs.existsSync(chunkDir)) {
            fs.rm(chunkDir, { recursive: true }, (err) => {
                if (err) console.error('清理分片目录失败:', err);
            });
        }

        ctx.body = {
            code: 0,
            message: "清理成功"
        };
    } catch (e) {
        console.error("清理分片失败：", e);
        ctx.body = { code: 1, message: "清理失败" };
    }
}

exports.uploadFiles = async (ctx) => {
  try {
    const file = ctx.request.files.file;
    // 获取上传的文件
    const { originalFilename, size, mimetype, filepath } = file;
    
    // 生成文件hash（使用时间戳+文件名作为简单的hash）
    const fileHash = `${Date.now()}-${originalFilename}-${size}`;

    // 通过解构拿到文件的信息
    const uploadDir = path.join(__dirname, "../uploads");
    //  新建一个存储路径
    const fileName = `${Date.now()}--${originalFilename}`;
    const filePath = path.join(uploadDir, fileName);
    
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 移动文件
    const reader = fs.createReadStream(filepath);
    const writer = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      reader.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    try {
      // 先检查数据库是否存在 file_hash 字段
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'files' 
        AND COLUMN_NAME = 'file_hash'
      `);

      // 如果不存在 file_hash 字段，添加该字段
      if (columns.length === 0) {
        await pool.query(`
          ALTER TABLE files
          ADD COLUMN file_hash VARCHAR(255) NULL DEFAULT NULL
          AFTER mimetype
        `);
      }

      // 保存文件信息到数据库（包含file_hash）
      const [result] = await pool.query(
        "INSERT INTO files (filename, path, size, mimetype, file_hash) VALUES (?, ?, ?, ?, ?)",
        [originalFilename, fileName, size, mimetype, fileHash]
      );

      ctx.body = {
        code: 0,
        message: "上传成功",
        data: {
          id: result.insertId,
          fileName: originalFilename,
          fileSize: size,
          fileType: mimetype,
        },
      };
    } catch (dbError) {
      console.error("数据库操作错误：", dbError);
      
      // 如果是字段不存在的错误，尝试修改表结构
      if (dbError.code === 'ER_NO_DEFAULT_FOR_FIELD' || dbError.code === 'ER_BAD_FIELD_ERROR') {
        try {
          // 修改表结构，允许 file_hash 为空
          await pool.query(`
            ALTER TABLE files
            MODIFY COLUMN file_hash VARCHAR(255) NULL DEFAULT NULL
          `);

          // 重新尝试插入
          const [result] = await pool.query(
            "INSERT INTO files (filename, path, size, mimetype, file_hash) VALUES (?, ?, ?, ?, ?)",
            [originalFilename, fileName, size, mimetype, fileHash]
          );

          ctx.body = {
            code: 0,
            message: "上传成功",
            data: {
              id: result.insertId,
              fileName: originalFilename,
              fileSize: size,
              fileType: mimetype,
            },
          };
        } catch (alterError) {
          console.error("修改表结构失败：", alterError);
          throw alterError;
        }
      } else {
        throw dbError;
      }
    }
  } catch (e) {
    console.error("上传错误：", e);
    // 清理临时文件
    if (ctx.request.files.file) {
      fs.unlink(ctx.request.files.file.filepath, () => {});
    }
    ctx.body = {
      code: 1,
      message: "上传失败，服务器出了差错",
    };
  }
};