import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isNotUndefinedOrNull } from 'shared/utils';

const image_checked     = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAMAAAAolt3jAAAAe1BMVEUAAAAA/wAA/wBVqgAzzAAr1QArvxUwvxgtwxcwwRUuxBQswhYrwxYrxRUtwxQsxBQuwxQswRMswhQuwhQtwRMtwhMtwhUswRUtwhQtwxQtwhQuwhQtwhQswhMtwhQtwhQtwhQtwhQtwhQswhQtwhUtwhQtwhQtwhT///9LLE7JAAAAJ3RSTlMAAQIDBQYYICIlJy4vMDM0TYSWl52foKGjqbGztbje4uPl6uvs7vkQLrq7AAAAAWJLR0QovbC1sgAAAGBJREFUCB0FwQUCggAABLABYmNgdwDe/3/oBgAAgHICAEX72wBQ7pMngGKXDGuj7RzKQ9I33POZUR2TvkGbvKfVKemWUJ6T1yPplkB1SZJhBVDfkm4BQH39LgCgHgMAAP7dMwdDlXIbegAAAABJRU5ErkJggg==';
    const image_unchecked   = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAMAAAAolt3jAAAAWlBMVEUAAADbJCS/ICDMGhrEFBTMFBTPExPQExPOFhbPFRXNFRXOFRXOFBTOFBTNFhbOFhbOFhbOFRXPFRXNFRXPFBTNFBTOFhbOFhbOFRXOFRXOFRXOFRXOFRX///+8mRfKAAAAHHRSTlMABwgKDTI1Njl5e3x9foCBgoOEhYmKjO3u7/DxBRZ/UgAAAAFiS0dEHesDcZEAAABhSURBVAgdBcELQoIAAECxhZoZ8jE1Qt/9z9mGA8ABvt4TsOxnju8aYa2/gbmaWKorLNX9WX0Dc1VdAR5VNwC/VT8Aa1VNwL1aH9UIazUyVxPHV11gqe2D0zYC8/4JA8DAP4Q4CIMsa252AAAAAElFTkSuQmCC';
    const image_leveldown   = 'data:image/png;base64,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'

export const fileFormatter = function(list, options, setFileContents){
    const leftCellAlignement = options.leftCellAlignement || 2;
    const useImage = options.useImage || false;
    const title = options.title || 'Report';
    const filename = options.filename || 'report.pdf';
    const report = options.report || null;

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
                //console.log('row',row);
                rows.push(row.columns.filter(x => x != null).map((x,index) => {
                    const isCellIndent = index == 0 && row.indent != 0;
                    return {
                        cellIndent: isCellIndent, // add indent only for the first row
                        content: isNotUndefinedOrNull(x.value)? x.value:'', 
                        colSpan: x.width, 
                        rowSpan: x.height, // indent
                        styles: { 
                            halign: index<leftCellAlignement?'left':'center',valign:'middle',
                            cellPadding:{
                                left:isCellIndent?(10+4+2):2,
                                top:2,
                                right:2,
                                bottom:2
                            },
                            lineColor:'#999',lineWidth:{left:1,right:1},
                            cellWidth:x.component._column.width || x.component._column.columns.reduce((total, y) => total + y.width,0),
                            minCellHeight:20//Math.max(0,...x.component._column.cells.map(x => x.height || 0))
                        }
                    }
                }));
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
    var originalDoc = new jsPDF({
        orientation:rows.length < 30 ? "landscape":"portrait",
        format:[pageHeight, pageWidth],
        unit:"px"
    })           

    //trigger file download, passing the formatted data and mime type
    //doc.output('blob')
    
    autoTable.default(originalDoc, {
        head: headers,
        body: rows,
        theme:'striped',
        didParseCell: async ({cell,doc,section}) => {
            if (section === 'body') {
                // Matrix Reporting
                if(report == 'Matrix'){
                    if(typeof cell.raw.content == 'object'){
                        if( isNotUndefinedOrNull(cell.raw.content.perm1) 
                            && cell.raw.content.perm1 == cell.raw.content.perm2
                        ){
                            cell.styles.fillColor = "#747474";
                            cell.text = ''; // reset
                        }else{
                            const total =  Object.values(cell.raw.content)
                            .filter(x => typeof x === "number")
                            .reduce((acc,item) => acc + item,0);

                            if(total < 10){
                                cell.styles.fillColor = "#669900";
                            }else if(total >= 10 && total < 20){
                                cell.styles.fillColor = "#ff5d2d";
                            }else if (total >= 20){
                                //cell.styles.fillColor = "#cc3333";
                            }
                            cell.text  = [`${total}`];
                        }
                        
                    }
                    
                    
                }
                //  Boolean procesing
                if(cell.raw.content === true || cell.raw.content === false){
                    cell.text = [];
                    if(!useImage){
                        if(cell.raw.content === true){
                            cell.styles.fillColor = 'green';
                        }else if(cell.raw.content === false){
                            cell.styles.fillColor = 'red';
                        }
                    }
                }
                
                
            }
        },
        didDrawCell: async ({cell,doc,section}) => {
            //console.log('doc',doc);
            //console.log('cell.raw.cellIndent',cell.raw.cellIndent);
            if (section === 'body' && useImage) {
                if(cell.raw.content === true){
                    doc.addImage(image_checked, cell.x + cell.width/2 - 4, cell.y + cell.contentHeight/2 - 4 , 8, 8)
                }else if(cell.raw.content === false){
                    doc.addImage(image_unchecked, cell.x + cell.width/2 - 4, cell.y + cell.contentHeight/2 - 4, 8, 8)
                }
            }
            if(cell.raw.cellIndent){
                doc.addImage(image_leveldown,cell.x + 4 ,cell.y + cell.contentHeight/2 - 5,10,10)
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
