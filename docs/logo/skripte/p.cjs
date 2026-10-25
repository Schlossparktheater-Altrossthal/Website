const {chromium}=require(process.argv[2]);(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1470,height:900}});
await p.goto('file://'+require('path').resolve(process.argv[3]||__dirname+'/../konzept/konzept.html'));await p.waitForTimeout(400);
await p.screenshot({path:require('path').resolve(__dirname,'../konzept/konzeptblatt-1.png'),fullPage:true});
await p.pdf({path:require('path').resolve(__dirname,'../konzept/konzeptblatt-1.pdf'),width:'1470px',height:'1500px',printBackground:true});await b.close();})();
