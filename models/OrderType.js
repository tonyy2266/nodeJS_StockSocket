"use strict";

module.exports = function (sequelize, DataTypes) {
    var OrderType = sequelize.define("OrderType", {
        stockExchange: {
            type: DataTypes.ENUM('HNX', 'HOSE', 'UPCOM'),
            field: 'stock_exchange'
        },
        orderName: {
            type: DataTypes.STRING,
            field: 'order_name'
        },
        startTime: {
            type: DataTypes.TIME,
            field: 'start_time'
        },
        endTime: {
            type: DataTypes.TIME,
            field: 'end_time'
        },
        description: {
            type: DataTypes.STRING(500),
            field: 'description'
        },
        deletedAt: {
            type: DataTypes.DATE,
            field: 'deleted_at'
        }
    }, {
            tableName: 'order_type_configuration'
        });

    return OrderType;
};