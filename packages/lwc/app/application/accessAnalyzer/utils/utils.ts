//import jsPDF from 'jspdf';
//import autoTable from 'jspdf-autotable';
import { isNotUndefinedOrNull } from 'shared/utils';

type PdfExportOptions = {
    leftCellAlignement?: number;
    useImage?: boolean;
    title?: string;
    filename?: string;
    report?: string | null;
    greenTreshold?: number;
    orangeTreshold?: number;
};

const image_checked =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAMAAAAolt3jAAAAe1BMVEUAAAAA/wAA/wBVqgAzzAAr1QArvxUwvxgtwxcwwRUuxBQswhYrwxYrxRUtwxQsxBQuwxQswRMswhQuwhQtwRMtwhMtwhUswRUtwhQtwxQtwhQuwhQtwhQswhMtwhQtwhQtwhQtwhQtwhQswhQtwhUtwhQtwhQtwhT///9LLE7JAAAAJ3RSTlMAAQIDBQYYICIlJy4vMDM0TYSWl52foKGjqbGztbje4uPl6uvs7vkQLrq7AAAAAWJLR0QovbC1sgAAAGBJREFUCB0FwQUCggAABLABYmNgdwDe/3/oBgAAgHICAEX72wBQ7pMngGKXDGuj7RzKQ9I33POZUR2TvkGbvKfVKemWUJ6T1yPplkB1SZJhBVDfkm4BQH39LgCgHgMAAP7dMwdDlXIbegAAAABJRU5ErkJggg==';
const image_unchecked =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAMAAAAolt3jAAAAWlBMVEUAAADbJCS/ICDMGhrEFBTMFBTPExPQExPOFhbPFRXNFRXOFRXOFBTOFBTNFhbOFhbOFhbOFRXPFRXNFRXPFBTNFBTOFhbOFhbOFRXOFRXOFRXOFRXOFRX///+8mRfKAAAAHHRSTlMABwgKDTI1Njl5e3x9foCBgoOEhYmKjO3u7/DxBRZ/UgAAAAFiS0dEHesDcZEAAABhSURBVAgdBcELQoIAAECxhZoZ8jE1Qt/9z9mGA8ABvt4TsOxnju8aYa2/gbmaWKorLNX9WX0Dc1VdAR5VNwC/VT8Aa1VNwL1aH9UIazUyVxPHV11gqe2D0zYC8/4JA8DAP4Q4CIMsa252AAAAAElFTkSuQmCC';
const image_leveldown =
    'data:image/png;base64,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';

export const fileFormatter = function (
    list,
    options: PdfExportOptions = {},
    setFileContents?: (contents: unknown, mime: string) => void
) {
    const leftCellAlignement = options.leftCellAlignement || 2;
    const useImage = options.useImage || false;
    const title = options.title || 'Report';
    const filename = options.filename || 'report.pdf';
    const report = options.report || null;
    const greenTreshold = options.greenTreshold || 10;
    const orangeTreshold = options.orangeTreshold || 20;

    var headers = [];
    var rows = [];
    var tableWidth = 0;

    //iterate over rows
    list.forEach((row, index) => {
        switch (row.type) {
            case 'header':
                // Width calculator
                row.columns
                    .filter(x => x != null && x.depth == 1)
                    .forEach(x => {
                        tableWidth +=
                            x.component._column.width ||
                            x.component._column.columns.reduce((total, y) => total + y.width, 0);
                    });

                headers.push(
                    row.columns
                        .filter(x => x != null)
                        .map(x => {
                            return {
                                content: x.value,
                                colSpan: x.width,
                                rowSpan: x.height,
                                styles: {
                                    halign: 'center',
                                    fillColor: '#e6e6e6',
                                    textColor: '#555',
                                    valign: x.height > 1 ? 'center' : 'top',
                                    border: 3,
                                    lineColor: '#999',
                                    lineWidth: 1,
                                },
                            };
                        })
                );
                break;
            case 'group':
                //handle group header rows
                break;
            case 'calc':
                //handle calculation rows
                break;
            case 'row':
                //console.log('row',row);
                rows.push(
                    row.columns
                        .filter(x => x != null)
                        .map((x, index) => {
                            const isCellIndent = index == 0 && row.indent != 0;
                            return {
                                cellIndent: isCellIndent, // add indent only for the first row
                                content: isNotUndefinedOrNull(x.value) ? x.value : '',
                                colSpan: x.width,
                                rowSpan: x.height, // indent
                                styles: {
                                    halign: index < leftCellAlignement ? 'left' : 'center',
                                    valign: 'middle',
                                    cellPadding: {
                                        left: isCellIndent ? 10 + 4 + 2 : 2,
                                        top: 2,
                                        right: 2,
                                        bottom: 2,
                                    },
                                    lineColor: '#999',
                                    lineWidth: { left: 1, right: 1 },
                                    cellWidth:
                                        x.component._column.width ||
                                        x.component._column.columns.reduce(
                                            (total, y) => total + y.width,
                                            0
                                        ),
                                    minCellHeight: 20, //Math.max(0,...x.component._column.cells.map(x => x.height || 0))
                                },
                            };
                        })
                );
                break;
        }
    });

    /** Modify last Row */
    if (rows.length > 0) {
        rows[rows.length - 1].forEach(x => {
            x.styles.lineWidth.bottom = 1;
        });
    }

    let pageHeight = 80 + list.length * 30;
    let pageWidth = 80 + tableWidth;

    //setFileContents(doc.output('blob'), "application/pdf");
};
