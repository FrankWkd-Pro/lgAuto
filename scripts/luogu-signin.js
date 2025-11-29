const https = require('https');
const fs = require('fs');
const path = require('path');

// 存储文件路径
const DATA_FILE = path.join(__dirname, '../.data/luogu-signin.json');

// 检查是否为新的一天 (UTC+8)
const checkNewDay = (ts) => {
    const now = new Date();
    const lastSign = new Date(ts);
    
    // 转换为 UTC+8 时间
    const nowUTC8 = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const lastSignUTC8 = new Date(lastSign.getTime() + (8 * 60 * 60 * 1000));
    
    // 比较日期 (年-月-日)
    return nowUTC8.toDateString() !== lastSignUTC8.toDateString();
};

// 读取存储的数据
const readStoredData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('读取存储数据失败，将创建新文件');
    }
    return { ts: 0 };
};

// 写入存储的数据
const writeStoredData = (data) => {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('写入存储数据失败:', error.message);
        return false;
    }
};

// 发送签到请求
const sendSignRequest = () => {
    return new Promise((resolve, reject) => {
        const cookie = process.env.LUOGU_COOKIE;
        
        if (!cookie) {
            reject(new Error('未设置 LUOGU_COOKIE 环境变量'));
            return;
        }

        const options = {
            hostname: 'www.luogu.com.cn',
            port: 443,
            path: '/index/ajax_punch',
            method: 'GET',
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.luogu.com.cn/'
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(new Error(`解析响应失败: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.end();
    });
};

// 主函数
const main = async () => {
    console.log('🚀 开始检查洛谷签到状态...');
    
    const storedData = readStoredData();
    const currentTime = new Date().toLocaleString('zh-CN');
    
    console.log(`📅 当前时间: ${currentTime}`);
    console.log(`📝 上次签到时间: ${storedData.ts ? new Date(storedData.ts).toLocaleString('zh-CN') : '从未签到'}`);
    
    if (!storedData.ts || checkNewDay(storedData.ts)) {
        console.log('🔄 开始执行签到...');
        
        try {
            const response = await sendSignRequest();
            console.log('📨 服务器响应:', JSON.stringify(response));
            
            const code = parseInt(response.code);
            switch (code) {
                case 200:
                    console.log('✅ 洛谷签到成功!');
                    storedData.ts = Date.now();
                    writeStoredData(storedData);
                    break;
                case 201:
                    console.log(`❌ 签到失败: ${response.message}`);
                    if (response.message && response.message.includes("已经打过卡")) {
                        storedData.ts = Date.now();
                        writeStoredData(storedData);
                        console.log('📝 已更新签到时间');
                    }
                    break;
                default:
                    console.log('❓ 未知响应:', response);
            }
        } catch (error) {
            console.error('💥 签到过程中发生错误:', error.message);
        }
    } else {
        console.log('⏭️  今天已经签到过了，跳过执行');
    }
    
    console.log('🎉 签到流程执行完毕');
};

// 执行主函数
main().catch(error => {
    console.error('💥 脚本执行失败:', error);
    process.exit(1);
});
