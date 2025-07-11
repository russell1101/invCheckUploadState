// index.js

const express = require('express'); //POST
//const axios = require('axios'); //GET
const Tesseract = require('tesseract.js'); //OCR
const app = express();
const PORT = 80;

const fetch = require('node-fetch');//POST  //GET


// 使用 middleware 來解析 JSON 請求
app.use(express.json());

// 接收 POST 請求的 API
app.post('/api/data', async (req, res) => {
 const receivedData = req.body;

    try {
                console.log('收到的資料:', receivedData);



                // 預期格式
                const expectedKeys = ['invoiceDate', 'invoiceNumber', 'custid'];

                console.log('receivedData length :',  Object.keys(receivedData).length );
                console.log('expectedKeys length :',  expectedKeys.length );

                // 驗證：是否為物件、是否含有預期的欄位，且沒有多餘欄位
                const isValid =
                    typeof receivedData === 'object' &&
                    receivedData !== null &&
                    Object.keys(receivedData).length === expectedKeys.length &&
                    expectedKeys.every(key => key in receivedData);

                if (!isValid) {
                    return res.status(400).json({ success: -1, errmsg: '錯誤格式' });
                }

                // ✅ 提取欄位
                const invoiceState =  await actInvoiceInfo(receivedData);
                    console.log('invoiceState  值:', invoiceState );
                if (invoiceState !== null && invoiceState !== undefined  && invoiceState == 2) {
                    //目前看折讓跟開立回都是2
                        // 若格式正確，回傳成功
                        return res.status(200).json({
                            success: 1,
                            State:invoiceState
                        });
                }


                // 若格式正確，回傳成功
                return res.status(200).json({
                    success: -1
                });

        } catch (error) {
        console.error('❌ 處理失敗:', error);
        return res.status(500).json({
            success: -1,
            errmsg: '伺服器錯誤'
        });
    }
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器已啟動，監聽在 http://localhost:${PORT}`);
});


// 提取 invoiceDate, invoiceNumber, custid
async function actInvoiceInfo(data) {
    
    try {
        //第一步呼叫取得隨機碼
        const { token, image } = await fetchTokenAndImage();
        //OCR出數值
        const fiveDigitValue = await doOCRFromBase64(image,token);
        //第二步請求發票
        const ansytoken =   await sencendInvoice(fiveDigitValue,token,data); 
        //第三步取得發票
        const state = await getInvoiceInfo(ansytoken);



        return state;
    } catch (e) {
        console.error('流程失敗:', e);
        return null;
    }

    
}


//第一步呼叫取得隨機碼
async function fetchTokenAndImage(data) {
    console.log('第一步呼叫取得隨機碼');
    try {
        // 假設 API URL 為此，請依實際改寫
       
        const response2 = await fetch('https://service-mc.einvoice.nat.gov.tw/act/login/api/act002i/captcha');
        const response = await response2.json();  // 這才是取得 JSON 物件
        const { token, image } = response;
        //const { token, image } = response.data;

        if (!token || !image) {
            console.error('回傳資料格式錯誤');
            return null;
        }

        console.log('✅ 取得的 token:', token);
        console.log('✅ 取得的 image:', image);


 
        return response;

    } catch (error) {
        console.error('🚫 呼叫 API 失敗:', error.message);
        return null;
    }
}


/**
 * 傳入 base64 圖片，進行 OCR 辨識
 * @param {string} base64Image - base64 字串，可含 data:image/png;base64,...
 * @returns {Promise<string>} - 回傳辨識出的文字
 */
async function doOCRFromBase64(base64Image,token) {
    try {
            console.log('進行 OCR 辨識');
       // saveImage( `data:image/png;base64,${base64Image}`);

       const result = await Tesseract.recognize(
            `data:image/png;base64,${base64Image}`,
            'eng', // 可改為 'chi_tra' 辨識繁體中文，要額外設定語言包
            {
                tessedit_char_whitelist: '0123456789'//,
                //logger: m => console.log(m)
            }
        );
        /*
        const { result } = await Tesseract.recognize(
            `data:image/png;base64,${base64Image}`,
             'eng', {
            tessedit_char_whitelist: '0123456789',
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/worker.min.js',
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm',
            workerBlobURL: false, // ✅ 關鍵設定：使用 blob url 替代本地路徑
        });*/

       // console.log(result.data.text);

        const match = result.data.text.match(/\d{5}/);

        if (match) {
            const fiveDigitValue = match[0];
            console.log('取得的五碼數值:', fiveDigitValue);
           // return fiveDigitValue;
            return fiveDigitValue;
            

        } else {
            //再做一次
            return null;
        }

    
    } catch (error) {
        console.error('OCR 失敗:', error);
         return null;
    }
}

//第二步請求發票
async function sencendInvoice(fiveDigitValue,token,data) {
    try {
        console.log('第二步請求發票');

        const { invoiceDate, invoiceNumber, custid } = data;
        console.log('captcha:', fiveDigitValue);
        const invoiceNumberWithTime = `${invoiceDate}T00:00:00.000Z`;
      
        // 假設 API URL 為此，請依實際改寫
        const url = 'https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/btc601w/getInvoiceJwt';

        const postData = {
                "captcha":`${fiveDigitValue}`,
                "invoiceDate": invoiceNumberWithTime,
                "invoiceNumber": invoiceNumber,
                "personalCode": "",
                "token": token
        };
        console.log('📤 postData:', JSON.stringify(postData, null, 2));
        /*
        const response = await axios.post(url, postData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });*/

        const response2 = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });
        const response = await response2.text();  // 這才是取得 JSON 物件
       

        console.log('✅ POST 成功，伺服器回應:', response);
        return response;

    } catch (error) {
        console.error('🚫 呼叫 API 失敗:', error.message);
        return null;
    }
}



//第三步取得發票資訊
async function getInvoiceInfo(token) {
    try {
       console.log('第三步取得發票資訊');
      
        // 假設 API URL 為此，請依實際改寫
        const url = 'https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/btc601w/getInvoiceData';

 
        console.log('📤 posttoken:', token);
        /*
        const response = await axios.post(url, token, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        */

       // console.log('✅ POST3 成功，伺服器回應:', response.data);


        const response2 = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: token
        });
        const response = await response2.json();  // 這才是取得 JSON 物件
        const responseData = response;

        if (isValidInvoiceResponse(responseData)) {
            //分析結果
           
            if (responseData.extStatus === '2') {
                console.log('📌 extStatus 為 2：代表查詢成功');
                // 可執行接下來的業務邏輯
            } else {
                console.warn(`⚠️ extStatus 不為 2，目前值為: ${responseData.extStatus}`);
                // 可提示使用者發票不存在、格式錯誤、無法查詢等
            }
            return responseData.extStatus;
        } else {
            console.error('❌ 回傳資料格式錯誤:', responseData);
             return null;
        }


    } catch (error) {
        console.error('🚫 呼叫 API3 失敗:', error.message);
        return null;
    }
}

//驗證第三步最後是否符合以下格式回傳
function isValidInvoiceResponse(data) {
    const requiredKeys = [
        'invoiceDate',
        'invoiceTime',
        'invoiceInstantDate',
        'totalAmount',
        'extStatus',
        'donateMark',
        'sellerName',
        'sellerId',
        'currency',
        'sellerAddress',
        'buyerName',
        'mainRemark',
        'alwFlag',
        'randomNumber',
        'invoiceStrStatus'
    ];

    return requiredKeys.every(key => key in data);
}

/**
 * 將 base64 圖片存成本地圖片，再進行 OCR 辨識
 * @param {string} base64Image - 不含 data:image 開頭的 base64 純資料
 * @returns {Promise<string>} 辨識出的文字
 */
/*
async function saveImage(base64Image) {
    const outputImagePath = path.join(__dirname, 'temp_image.png');

    try {
        // 🖼️ 將 base64 轉成 buffer 並存成 png 檔
        const imageBuffer = Buffer.from(base64Image, 'base64');
        fs.writeFileSync(outputImagePath, imageBuffer);
        console.log(`圖片已儲存：${outputImagePath}`);



    } catch (error) {
        console.error('OCR 失敗:', error);
        throw error;
    } finally {
        
        // 🧹 清除暫存圖片
        if (fs.existsSync(outputImagePath)) {
            fs.unlinkSync(outputImagePath);
            console.log('已刪除暫存圖片');
        }
            
    }
}
 */