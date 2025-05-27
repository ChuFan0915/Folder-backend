const handlerDown = async (id) => {
  try {
    const response = await downloadFileAPI(id, {
      responseType: 'blob'  // 重要：指定响应类型为blob
    });
    
    // 从响应头获取文件名
    const contentDisposition = response.headers['content-disposition'];
    let filename = '未命名文件';
    
    if (contentDisposition) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
      }
    }

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    ElMessage.success('下载成功');
  } catch (error) {
    console.error('下载失败：', error);
    ElMessage.error('下载失败，请稍后重试');
  }
}; 