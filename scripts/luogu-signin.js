const https = require('https');
const fs = require('fs');
const path = require('path');

// 时区偏移计算 (UTC+8)
const tz_offset = new Date().getTimezoneOffset() + 480;

// 存储文件路径
const DATA_FILE = path.join(__dirname, '../.data/luogu-signin.json');

// 检查是否为新的一天
const checkNewDay = (ts) => {
    const t = new Date(ts);
    t.setMinutes(t.getMinutes() + tz_offset);
    t.setHours(0, 0, 0, 0);
    const d = new Date();
    d.setMinutes(d.getMinutes() + tz_offset);
    d.setHours(0, 0, 0, 0);
    return (d.getTime() > t.getTime());
};

// 读取存储的数据
const readStoredData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('读取存储数据失败，将创建新文件:', error.message);
    }
    return { ts: 0, notified: false };
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

// 发送 HTTP 请求
const sendRequest = () => {
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.luogu.com.cn/',
                'Origin': 'https://www.luogu.com.cn'
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
                    reject(new Error(`解析响应失败: ${error.message}, 响应数据: ${data}`));
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

// 主签到函数
const sign = async () => {
    const storedData = readStoredData();
    
    if (!storedData.notified) {
        console.log('首次运行洛谷自动签到脚本');
        storedData.notified = true;
        writeStoredData(storedData);
    }

    try {
        const response = await sendRequest();
        console.log('响应:', JSON.stringify(response, null, 2));
        
        const code = parseInt(response.code);
        switch (code) {
            case 200: {
                console.log('✅ 洛谷签到成功!');
                storedData.ts = Date.now();
                writeStoredData(storedData);
                break;
            }
            case 201: {
                console.log(`❌ 签到失败: ${response.message}`);
                if (response.message && response.message.indexOf("已经打过卡") > -1) {
                    storedData.ts = Date.now();
                    writeStoredData(storedData);
                    console.log('📝 已记录本次签到时间');
                }
                break;
            }
            default: {
                console.log('❓ 未知错误:', response);
            }
        }
    } catch (error) {
        console.error('💥 请求签到时发生错误:', error.message);
        process.exit(1);
    }
};

// 主执行逻辑
const main = async () => {
    const storedData = readStoredData();
    
    if (!storedData.ts || checkNewDay(storedData.ts)) {
        console.log('🔄 开始执行洛谷签到...');
        await sign();
    } else {
        console.log('⏭️  今天已经签到过了，跳过执行');
        
        // 显示下次签到时间
        const nextSignTime = new Date(storedData.ts);
        nextSignTime.setDate(nextSignTime.getDate() + 1);
        nextSignTime.setHours(0, 0, 0, 0);
        console.log(`⏰ 下次签到时间: ${nextSignTime.toLocaleString('zh-CN')}`);
    }
};

// 运行主函数
main().catch(error => {
    console.error('💥 脚本执行失败:', error);
    process.exit(1);
});
