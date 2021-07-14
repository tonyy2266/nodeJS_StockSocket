function writeExcelCell(content, rowIndex, cellIndex, worksheet) {
    // console.log('Content: ' + content + ' - rowIndex: ' + rowIndex + ' - colIndex: ' + cellIndex);
    var row = worksheet.getRow(rowIndex);
    row.getCell(cellIndex).value = content;
    row.commit();
}

function drawExcelBorder(cellName, style, color, worksheet) {
    // set double thin green border around A3
    // console.log('aloooo')
    worksheet.getCell(cellName).border = {
        top: { style: style, color: { argb: color } },
        left: { style: style, color: { argb: color } },
        bottom: { style: style, color: { argb: color } },
        right: { style: style, color: { argb: color } }
    };
}

function setColumnWidth(columnNumer, width, worksheet) {
    worksheet.getColumn(columnNumer).width = width;
}

function numberToExcelColumnText(num) {
    for (var ret = '', a = 1, b = 26; (num -= a) >= 0; a = b, b *= 26) {
        ret = String.fromCharCode(parseInt((num % b) / a) + 65) + ret;
    }
    return ret;
}

exports.numberToExcelColumnText = numberToExcelColumnText;
exports.setColumnWidth = setColumnWidth;
exports.writeExcelCell = writeExcelCell;
exports.drawExcelBorder = drawExcelBorder;