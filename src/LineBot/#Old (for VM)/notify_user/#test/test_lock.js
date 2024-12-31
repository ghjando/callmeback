import AsyncLock from 'async-lock';
var lock = new AsyncLock({timeout: 900});

function main() {
    //setTimeout(() => task(1), 1000);
    //setTimeout(() => task(2), 1000);
    setInterval(() => task(1), 1000);
    setInterval(() => task(2), 1000);
}

async function task(thread_id) {
    console.log('线程启动: ' + thread_id);
    //await lock.acquire('key_'+thread_id, async () => {
    lock.acquire('key_'+thread_id, async () => {
        console.log(thread_id + '开始工作');
        await sleep(2500);
        console.log(thread_id + '工作完毕');
        console.log('释放' + thread_id);
    }, async (err, ret) => {
        if (err) {
          console.log('工作'+thread_id+'取得 lock 失敗：\n');
          console.log(err);
        }
        if (ret) console.log(ret);
    });
    //console.log('释放' + thread_id);
}

function sleep(n) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(null);
        }, n);
    });
}

main();