// built-in
import * as fs from 'fs';
import * as path from 'path';

// custom libs/files
import CONFIG from './config.js';
import { renamingPreproc, generateProduct, substituteConst } from './ModelGenerator/gen_product.js';
import { approximateLocalDomain, restictionOfLocalDomain } from './ModelGenerator/approx_ld.js';
import { generateAbstractModel } from './ModelGenerator/gen_abstract.js';
import UppaalXML from './Parser/uppaalxml.js';

const NS_PER_SEC = 1e9;

let _inputStr = fs.readFileSync(CONFIG.pathToInputModel, "utf8");
let _inputStrOrig = _inputStr;


const TEMP_LOG = `./temp_log.txt`;
fs.writeFileSync(TEMP_LOG, `${new Date()}\n`);

for(let nv = 1; nv<=10; nv++){
    _inputStr = _inputStrOrig.replace(/(?<=const int N_V = )(\d)/, `${nv}`);
    for(let nc = 1; nc<=3; nc++){
        _inputStr = _inputStr.replace(/(?<=const int N_C = )(\d)/, `${nc}`);
        let time;
        let modelName;
        let model = new UppaalXML(_inputStr);

        let _inputStr2 = substituteConst(model, {
            'N_V':nv,
            'N_C':nc
        }).toString();
        
        
        let measureTime = (cb)=>{
            let hrStart = process.hrtime();
            cb();
            let hrDiff = process.hrtime(hrStart);
            return (hrDiff[0]*NS_PER_SEC + hrDiff[1])/1000000;
        }

        modelName = `c_${nv}_${nc}`;
        time = measureTime(()=>fs.writeFileSync(`./output_files/c/${modelName}.xml`, _inputStr2))
        console.log(`${modelName} generated in ${time} ms`);
        fs.appendFileSync(TEMP_LOG, `${modelName} generated in ${time} ms\n`);

        
        modelName = `a1_${nv}_${nc}_must`;
        time = measureTime( ()=>fs.writeFileSync(`./output_files/${modelName}.xml`, doAbstraction1t(_inputStr2, false)) )
        console.log(`${modelName} generated in ${time} ms`);
        fs.appendFileSync(TEMP_LOG, `${modelName} generated in ${time} ms\n`);

        modelName = `a1_${nv}_${nc}_may`;
        time = measureTime( ()=>fs.writeFileSync(`./output_files/${modelName}.xml`, doAbstraction1t(_inputStr2)) )
        console.log(`${modelName} generated in ${time} ms`);
        fs.appendFileSync(TEMP_LOG, `${modelName} generated in ${time} ms\n`);

        modelName = `a2_${nv}_${nc}_may`;
        time = measureTime(()=>fs.writeFileSync(`./output_files/${modelName}.xml`, doAbstraction2t(_inputStr2, nv)))
        console.log(`${modelName} generated in ${time} ms`);
        fs.appendFileSync(TEMP_LOG, `${modelName} generated in ${time} ms\n`);
        
        modelName = `a2_${nv}_${nc}_must`;
        time = measureTime(()=>fs.writeFileSync(`./output_files/${modelName}.xml`, doAbstraction2t(_inputStr2, nv, false)));
        console.log(`${modelName} generated in ${time} ms`);
        fs.appendFileSync(TEMP_LOG, `${modelName} generated in ${time} ms\n`);

        modelName = `a3_${nv}_${nc}_may`;
        time = measureTime(()=>fs.writeFileSync(`./output_files/${modelName}.xml`, doAbstraction12t(_inputStr2, nv)))
        console.log(`${modelName} generated in ${time} ms`);
        fs.appendFileSync(TEMP_LOG, `${modelName} generated in ${time} ms\n`);
        
        modelName = `a3_${nv}_${nc}_must`;
        time = measureTime(()=>fs.writeFileSync(`./output_files/${modelName}.xml`, doAbstraction12t(_inputStr2, nv, false)))
        console.log(`${modelName} generated in ${time} ms`);
        fs.appendFileSync(TEMP_LOG, `${modelName} generated in ${time} ms\n`);
    }
}


// newline fix
function newlineFix(str){
    let nl_reg = /(?<=<label[^<]*?kind="assignment"[^<]*?>)([^<]*?)(?=<\/label>)/g;
    return str.replace(nl_reg,function(match){
        return match.replace(/\s+/gm,'').split(',').join(',\n')
    })
}

function convertMapping(myMapping){
    let res = {};
    for(let x in myMapping){
        res[x] = [...myMapping[x] ].map(s=>{
            return s.split(';').flatMap(v=>{
                return v.split(',').map(x=>Number(x))
            })
        })
    }
    return res;
}

// ================================
// Abstraction 1 
// (remove mem_vt, mem_sg)
// ================================

function doAbstraction1t(inputStr, may=true){
    let _ld = approximateLocalDomain(
        inputStr,
        {
            vars: ['mem_sg', 'mem_vt'],
            valInit: [0, 0]
        },
        "Voter",
        may
    );
    let _d = convertMapping(_ld);


    let aparams = {
        template: "Voter",
        scope: "*",
        val0: {
            'mem_sg': 0,
            'mem_vt': 0
        },
        get argsR() {
            return Object.keys(this.val0)
        },
        d: _d,
        argsN: [
        ],
        arrDict:{}
    }

    let amodel = generateAbstractModel(
        inputStr, 
        aparams
    );

    return amodel.toString();
}

function doAbstraction2t(inputStr, NV, may=true){
    let _ld1 = approximateLocalDomain(
        inputStr,
        {
            vars: ['mem_dec'],
            valInit: [0]
        },
        "Voter",
        may
    );

    let _ld2 = approximateLocalDomain(
        inputStr,
        {
            vars: ['dec_recv'],
            valInit: [Array.from({length:Number(NV)}, x=>0)],
        },
        "Authority",
        may
    );
    

    let _d1 = convertMapping(_ld1);
    let _d2 = convertMapping(_ld2);


    let aparams1 = {
        template: "Voter",
        // scope: "*",
        scope: 'id0,id1',
        val0: {
            'mem_dec': 0,
        },
        get argsR() {
            return Object.keys(this.val0)
        },
        d: _d1,
        argsN: [
        ],
    }

    let aparams2 = {
        template: "Authority",
        scope: 'id4',
        val0: {
            'dec_recv': [Array.from({length:Number(NV)}, x=>0)],
        },
        get argsR() {
            return Object.keys(this.val0)
        },
        d: _d2,
        argsN: [
        ],
        arrDict:{
            'dec_recv':NV
        }
    }

    let amodel = generateAbstractModel(
        inputStr, 
        aparams1
    );

    amodel = generateAbstractModel(
        amodel.toString(), 
        aparams2
    );

    return amodel.toString();
}

function doAbstraction12t(inputStr, NV, may=true){
    let _ld1 = approximateLocalDomain(
        inputStr,
        {
            vars: ['mem_dec', 'mem_sg', 'mem_vt'],
            valInit: [0, 0, 0]
        },
        "Voter",
        may
    );

    let _ld2 = approximateLocalDomain(
        inputStr,
        {
            vars: ['dec_recv'],
            valInit: [Array.from({length:Number(NV)}, x=>0)],
        },
        "Authority",
        may
    );
    

    let _d1 = convertMapping(_ld1);
    let _d2 = convertMapping(_ld2);

    let aparams1 = {
        template: "Voter",
        scope: 'id0,id1',
        val0: {
            'mem_dec': 0,
            'mem_sg': 0,
            'mem_vt': 0
        },
        get argsR() {
            return Object.keys(this.val0)
        },
        d: _d1,
        argsN: [
        ],
    }

    let aparams2 = {
        template: "Authority",
        scope: 'id4',
        val0: {
            'dec_recv': [Array.from({length:Number(NV)}, x=>0)],
        },
        get argsR() {
            return Object.keys(this.val0)
        },
        d: _d2,
        argsN: [
        ],
        arrDict:{
            'dec_recv':NV
        }
    }

    let amodel = generateAbstractModel(
        inputStr, 
        aparams1
    );

    amodel = generateAbstractModel(
        amodel.toString(), 
        aparams2
    );

    return amodel.toString();
}
