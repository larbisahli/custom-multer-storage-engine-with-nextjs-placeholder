"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorNames = exports.OrderBy = exports.SortOrder = void 0;
var SortOrder;
(function (SortOrder) {
    SortOrder["Asc"] = "ASC";
    SortOrder["Desc"] = "DESC";
})(SortOrder = exports.SortOrder || (exports.SortOrder = {}));
var OrderBy;
(function (OrderBy) {
    OrderBy["CREATED_AT"] = "created_at";
    OrderBy["UPDATED_AT"] = "updated_at";
})(OrderBy = exports.OrderBy || (exports.OrderBy = {}));
var ErrorNames;
(function (ErrorNames) {
    ErrorNames["USER_ALREADY_EXIST"] = "USER_ALREADY_EXIST";
    ErrorNames["EMAIL_ALREADY_EXIST"] = "EMAIL_ALREADY_EXIST";
    ErrorNames["SERVER_ERROR"] = "SERVER_ERROR";
    ErrorNames["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ErrorNames["SOMETHING_HAPPENED"] = "SOMETHING_HAPPENED";
    ErrorNames["TRANSACTION_ERROR"] = "TRANSACTION_ERROR";
    ErrorNames["STAFF_DOES_NOT_EXIST"] = "STAFF_DOES_NOT_EXIST";
})(ErrorNames = exports.ErrorNames || (exports.ErrorNames = {}));
//# sourceMappingURL=custom.types.js.map