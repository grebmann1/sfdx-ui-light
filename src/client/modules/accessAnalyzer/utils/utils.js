import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isNotUndefinedOrNull } from 'shared/utils';

export const fileFormatter = function(list, options, setFileContents){
    const useImage = false || options.useImage;
    const title = options.title || 'Report';
    const filename = options.filename || 'report.pdf';

    var headers = [];
    var rows = [];
    var tableWidth = 0;

    //iterate over rows
    list.forEach((row,index) => {
        switch(row.type){
            case "header":
                // Width calculator
                row.columns.filter(x => x != null && x.depth == 1).forEach(x => {
                    tableWidth += x.component._column.width || x.component._column.columns.reduce((total, y) => total + y.width,0)
                });

                headers.push(row.columns.filter(x => x != null).map(x => {
                    return {
                        content: x.value, 
                        colSpan: x.width, 
                        rowSpan: x.height, 
                        styles: { 
                            halign: 'center',fillColor:'#e6e6e6',textColor:'#555',
                            valign: x.height > 1?'center':'top',border:3,
                            lineColor:'#999',lineWidth:1
                        }
                    }
                }));
            break;
            case "group":
                //handle group header rows
            break;
            case "calc":
                //handle calculation rows
            break;
            case "row":
                rows.push(row.columns.filter(x => x != null).map(x => ({
                    content: isNotUndefinedOrNull(x.value)? x.value:'', 
                    colSpan: x.width, 
                    rowSpan: x.height, 
                    styles: { 
                        halign: 'center',valign:'middle',cellPadding:2,
                        lineColor:'#999',lineWidth:{left:1,right:1},
                        cellWidth:x.component._column.width || x.component._column.columns.reduce((total, y) => total + y.width,0),
                        minCellHeight:20//Math.max(0,...x.component._column.cells.map(x => x.height || 0))
                    }
                })));
            break;
        }
    });

    /** Modify last Row */
    if(rows.length > 0){
        rows[rows.length - 1].forEach(x => {
            x.styles.lineWidth.bottom = 1;
        })
    }

    
    let pageHeight = 80 + list.length*30;
    let pageWidth = 80 + tableWidth;
    console.log('headers',headers,pageWidth);
    console.log('[pageHeight, pageWidth]',[2000, pageWidth]);
    console.log('rows',rows);
    var originalDoc = new jsPDF({
        orientation:rows.length < 30 ? "landscape":"portrait",
        format:[pageHeight, pageWidth],
        unit:"px"
    })           

    //trigger file download, passing the formatted data and mime type
    //doc.output('blob')
    let image_checked = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAMAAAAolt3jAAAAe1BMVEUAAAAA/wAA/wBVqgAzzAAr1QArvxUwvxgtwxcwwRUuxBQswhYrwxYrxRUtwxQsxBQuwxQswRMswhQuwhQtwRMtwhMtwhUswRUtwhQtwxQtwhQuwhQtwhQswhMtwhQtwhQtwhQtwhQtwhQswhQtwhUtwhQtwhQtwhT///9LLE7JAAAAJ3RSTlMAAQIDBQYYICIlJy4vMDM0TYSWl52foKGjqbGztbje4uPl6uvs7vkQLrq7AAAAAWJLR0QovbC1sgAAAGBJREFUCB0FwQUCggAABLABYmNgdwDe/3/oBgAAgHICAEX72wBQ7pMngGKXDGuj7RzKQ9I33POZUR2TvkGbvKfVKemWUJ6T1yPplkB1SZJhBVDfkm4BQH39LgCgHgMAAP7dMwdDlXIbegAAAABJRU5ErkJggg==';
    let image_unchecked = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAMAAAAolt3jAAAAWlBMVEUAAADbJCS/ICDMGhrEFBTMFBTPExPQExPOFhbPFRXNFRXOFRXOFBTOFBTNFhbOFhbOFhbOFRXPFRXNFRXPFBTNFBTOFhbOFhbOFRXOFRXOFRXOFRXOFRX///+8mRfKAAAAHHRSTlMABwgKDTI1Njl5e3x9foCBgoOEhYmKjO3u7/DxBRZ/UgAAAAFiS0dEHesDcZEAAABhSURBVAgdBcELQoIAAECxhZoZ8jE1Qt/9z9mGA8ABvt4TsOxnju8aYa2/gbmaWKorLNX9WX0Dc1VdAR5VNwC/VT8Aa1VNwL1aH9UIazUyVxPHV11gqe2D0zYC8/4JA8DAP4Q4CIMsa252AAAAAElFTkSuQmCC';

    autoTable.default(originalDoc, {
        head: headers,
        body: rows,
        theme:'striped',
        didParseCell: async ({cell,doc,section}) => {
            if (section === 'body') {
                if(cell.raw.content === true || cell.raw.content === false){
                    cell.text = [];
                }

                if(!useImage){
                    if(cell.raw.content === true){
                        cell.styles.fillColor = 'green';
                    }else if(cell.raw.content === false){
                        cell.styles.fillColor = 'red';
                    }
                }
            }
        },
        didDrawCell: async ({cell,doc,section}) => {
            if (section === 'body' && useImage) {
                if(cell.raw.content === true){
                    doc.addImage(image_checked, cell.x + cell.width/2 - 4, cell.y + cell.contentHeight/2 - 4 , 8, 8)
                }else if(cell.raw.content === false){
                    doc.addImage(image_unchecked, cell.x + cell.width/2 - 4, cell.y + cell.contentHeight/2 - 4, 8, 8)
                }
            }
        },
        didDrawPage: function (data) {
            originalDoc.setFontSize(18)
            originalDoc.text(title, data.settings.margin.left, 22)
          },
    })
    const newWindow = window.open(originalDoc.output('bloburl',{filename}));
    newWindow.document.title = filename;


    //setFileContents(doc.output('blob'), "application/pdf");
}
