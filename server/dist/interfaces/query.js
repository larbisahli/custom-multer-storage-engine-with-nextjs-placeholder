"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponType = exports.OrderBy = exports.SortOrder = void 0;
// ******** <QUERIES> ********
var SortOrder;
(function (SortOrder) {
    /** Sort records in ascending order. */
    SortOrder["Asc"] = "ASC";
    /** Sort records in descending order. */
    SortOrder["Desc"] = "DESC";
})(SortOrder = exports.SortOrder || (exports.SortOrder = {}));
var OrderBy;
(function (OrderBy) {
    OrderBy["CREATED_AT"] = "created_at";
    OrderBy["UPDATED_AT"] = "updated_at";
})(OrderBy = exports.OrderBy || (exports.OrderBy = {}));
var CouponType;
(function (CouponType) {
    CouponType["Fixed"] = "fixed";
    CouponType["Percentage"] = "percentage";
    CouponType["FreeShipping"] = "free_shipping";
})(CouponType = exports.CouponType || (exports.CouponType = {}));
//# sourceMappingURL=query.js.map