'use strict';
/* global request */
/**
 * Controller for Humm Order management pages
 *
 */

/* API Includes */
var ISML = require('dw/template/ISML');

/**
 * Show order list
 * */
function orderList() {
    var ResourceHelper = require('~/cartridge/scripts/utils/resource');
    var pageSize = request.httpParameterMap.pagesize.value;
    var pageNumber = request.httpParameterMap.pagenumber.value;
    var orderNumber = request.httpParameterMap.ordernumber.value || '';
    var orderListResponse;

    pageSize = pageSize ? parseInt(pageSize, 10) : 10;
    pageNumber = pageNumber ? parseInt(pageNumber, 10) : 1;

    orderListResponse = require('~/cartridge/scripts/getOrders').output({
        pageSize: pageSize,
        pageNumber: pageNumber,
        orderNumber: orderNumber
    });
    orderListResponse.ResourceHelper = ResourceHelper;

    ISML.renderTemplate('application/orderlist', orderListResponse);
}

/**
 * Show order details
 * */
function orderDetails() {
    var ResourceHelper = require('~/cartridge/scripts/utils/resource');
    ISML.renderTemplate('application/orderdetails', { ResourceHelper: ResourceHelper });
}

/*
 * Exposed web methods
 */
orderList.public = true;
orderDetails.public = true;

exports.OrderList = orderList;
exports.OrderDetails = orderDetails;
