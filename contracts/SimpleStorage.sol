// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleStorage {
    // 存储结构体：数据 + 时间戳
    struct Record {
        string dataHash; // 模拟上链的数据（如文件的哈希）
        uint256 timestamp;
        address uploader;
    }

    Record[] public records;

    // 事件：当数据上链成功后触发
    event DataStored(uint256 indexed id, string dataHash, address uploader);

    // 写入功能：上链
    function storeData(string memory _dataHash) public {
        records.push(Record(_dataHash, block.timestamp, msg.sender));
        emit DataStored(records.length - 1, _dataHash, msg.sender);
    }

    // 读取功能：获取由于数组长度
    function getRecordCount() public view returns (uint256) {
        return records.length;
    }

    // 读取功能：根据索引获取数据
    function getRecord(uint256 _index) public view returns (string memory, uint256, address) {
        Record memory r = records[_index];
        return (r.dataHash, r.timestamp, r.uploader);
    }
}