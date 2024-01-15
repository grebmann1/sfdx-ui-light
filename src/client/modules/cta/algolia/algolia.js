import { LightningElement } from 'lwc';
import { runActionAfterTimeOut,isUndefinedOrNull,isNotUndefinedOrNull } from 'shared/utils';

export default class Algolia extends LightningElement {
    search;


    connectedCallback(){
        console.log('Algolia');
        runActionAfterTimeOut(null,(param) => {
            this.initialize_algolia();
        },{timeout:300});
        
    }


    /** Methods **/
    initialize_algolia = () => {
        const { algoliasearch, instantsearch } = window;
        const searchClient = algoliasearch('latency', '6be0576ff61c053d5f9a3225e2a90f76');

        const search = instantsearch({
            indexName: 'instant_search',
            searchClient,
        });
          
        search.addWidgets([
            instantsearch.widgets.searchBox({
                container: this.template.querySelector(".searchbox"),
            }),
            instantsearch.widgets.hits({
                container: this.template.querySelector(".hits"),
                templates: {
                    item: `
                        <article>
                        <h1>{{#helpers.highlight}}{ "attribute": "name" }{{/helpers.highlight}}</h1>
                        <p>{{#helpers.highlight}}{ "attribute": "description" }{{/helpers.highlight}}</p>
                        </article>
                    `,
                },
            }),
            instantsearch.widgets.panel({
                templates: { header: 'brand' },
            })(instantsearch.widgets.refinementList)({
                container: this.template.querySelector(".brand-list"),
                attribute: 'brand',
            }),
            instantsearch.widgets.pagination({
                container: this.template.querySelector(".pagination"),
            }),
        ]);
        
        search.start();
    }
    
}