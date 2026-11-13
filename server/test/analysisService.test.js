const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { compileFunction } = require('node:vm');

const source = readFileSync(join(__dirname, '../utils/analysisService.js'), 'utf8');
const entityValues = {
    Energy_Traded_kWh: 12.5,
    Transaction_Cost_USD: 3.25,
    Voltage_V: 221.5,
    Current_A: 7.5,
    Blockchain_Verified: 1,
    tx_count: 2
};
const riskValues = {
    Energy_Traded_kWh: 45.5,
    Transaction_Cost_USD: 8.75,
    Voltage_V: 219.5,
    Current_A: 6.5,
    Blockchain_Verified: 1,
    daily_tx_count: 3,
    Residential_Consumption_kWh: 4.5,
    Commercial_Consumption_kWh: 5.5,
    Industrial_Consumption_kWh: 6.5
};
const entityDefaults = {
    Energy_Traded_kWh: 0,
    Transaction_Cost_USD: 0,
    Voltage_V: 220,
    Current_A: 10,
    Blockchain_Verified: 1,
    tx_count: 1
};
const riskDefaults = {
    Energy_Traded_kWh: 0,
    Transaction_Cost_USD: 0,
    Voltage_V: 220,
    Current_A: 10,
    Blockchain_Verified: 1,
    daily_tx_count: 1,
    Residential_Consumption_kWh: 0,
    Commercial_Consumption_kWh: 0,
    Industrial_Consumption_kWh: 0
};
const fill = (fields, value) => Object.fromEntries(
    Object.keys(fields).map(field => [field, value])
);
const asStrings = fields => Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [field, String(value)])
);

// Execute the real service with isolated I/O: no MySQL, model server or packages needed.
async function checkAnalysis(entitySample, riskSample, expectedEntity, expectedRisk) {
    const requests = [];
    const records = [];
    const errors = [];
    const lookups = [];
    const dependencies = {
        axios: {
            async post(url, payload) {
                requests.push({ url, payload });
                return { data: {
                    entity_predictions: [{ pred_entity_label: 2 }],
                    risk_predictions: [{ pred_risk_label: 1 }]
                } };
            }
        },
        '../models/User': {
            async findByPk(id) {
                lookups.push(id);
                return { id };
            }
        },
        '../models/AnalyticsData': {
            async create(record) { records.push(record); }
        },
        crypto: { randomInt: () => 0 },
        '../test_entity.json': [{ ...entitySample, Entity_Type_Label: '2' }],
        '../test_risk.json': [riskSample]
    };
    const module = { exports: {} };
    const requireStub = name => {
        assert.ok(Object.hasOwn(dependencies, name), `unexpected dependency: ${name}`);
        return dependencies[name];
    };
    compileFunction(source, ['require', 'module', 'console'])(requireStub, module, {
        log() {},
        error(...args) { errors.push(args); }
    });

    await module.exports.runAnalysis(42, 7, 8, {});

    assert.deepEqual(errors, [], 'analysis should finish without a swallowed error');
    assert.deepEqual(lookups, [42]);
    assert.deepEqual(requests.map(request => request.url), [
        'http://localhost:5000/predict/entity',
        'http://localhost:5000/predict/risk'
    ]);
    assert.equal(records.length, 1);
    const record = records[0];
    for (const [index, expected, prefix] of [
        [0, expectedEntity, 'ent_'],
        [1, expectedRisk, 'risk_']
    ]) {
        assert.equal(requests[index].payload.length, 1);
        for (const [field, value] of Object.entries(expected)) {
            assert.equal(requests[index].payload[0][field], value, `request ${index}: ${field}`);
            const savedField = field.endsWith('_Consumption_kWh') ? field : prefix + field;
            assert.equal(record[savedField], value, `stored ${savedField}`);
        }
    }
    assert.equal(record.user_id, 42);
    assert.equal(record.product_id, 7);
    assert.equal(record.order_id, 8);
    assert.equal(record.true_entity_label, 2);
    assert.equal(record.pred_entity_label, 2);
    assert.equal(record.pred_risk_label, 1);
}

for (const zero of [0, '0']) {
    test(`preserves ${typeof zero} zero in model inputs and stored features`, async () => {
        await checkAnalysis(
            fill(entityValues, zero), fill(riskValues, zero),
            fill(entityValues, 0), fill(riskValues, 0)
        );
    });
}

test('does not replace zero risk values with nonzero entity values', async () => {
    await checkAnalysis(
        entityValues, fill(riskValues, 0), entityValues, fill(riskValues, 0)
    );
});

test('parses nonzero values and keeps the entity and risk samples independent', async () => {
    await checkAnalysis(asStrings(entityValues), asStrings(riskValues), entityValues, riskValues);
});

for (const [label, missing] of [['undefined', undefined], ['null', null], ['empty string', '']]) {
    test(`keeps existing defaults for ${label} features`, async () => {
        await checkAnalysis(
            fill(entityValues, missing), fill(riskValues, missing), entityDefaults, riskDefaults
        );
    });

    test(`falls back to parsed entity energy and cost when risk values are ${label}`, async () => {
        await checkAnalysis(
            asStrings(entityValues), fill(riskValues, missing), entityValues,
            {
                ...riskDefaults,
                Energy_Traded_kWh: 12.5,
                Transaction_Cost_USD: 3.25
            }
        );
    });
}
