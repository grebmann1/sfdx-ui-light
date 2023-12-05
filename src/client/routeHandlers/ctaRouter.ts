import { HandlerContext,RouteHandlerViewResponse,ViewRequest, ViewResponse } from 'lwr';

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isEmpty(str) {
  return (!str || str.length === 0 );
}
// Return a completely custom response
// containing some JSON data, based on the current path and query parameters
// viewRequest = { url, requestPath, params?, query? }
/*
export default function jsonRouteHandler(viewRequest: ViewRequest): ViewResponse {
  const myPathParam = viewRequest.params.my;
  const someQueryParams = viewRequest.query?.some;
  console.log('viewRequest',viewRequest);
  console.log('myPathParam',myPathParam);
  console.log('someQueryParams',someQueryParams);
  // return a "ViewResponse": { status?, body, cache?, headers? }
  return {
    // Required: return the response body
    body: {
      my: myPathParam,
      some: someQueryParams,
    },
    // Optional: HTTP header map
    headers: {
      'Content-Type': 'application/json',
    },
  };
}*/

export default async function ctaRouter(
  viewRequest: ViewRequest,
  handlerContext: HandlerContext,
): RouteHandlerViewResponse {
  const routeProperties = handlerContext.route.properties || {};
  const message = viewRequest.params.message;
  console.log('viewRequest',viewRequest);
  const staticUrl = "https://raw.githubusercontent.com/grebmann1/cta-cheat-sheet/main";
  const requestPath = viewRequest.requestPath.substring(4);

  if(isEmpty(requestPath)){
    routeProperties.manualText = "# CTA Cheat Sheet\n## Objective of this document\nThe goal of this document is to group key information that are needed to pass the salesforce CTA exam. Don't expect to see technical things in this documents but more **Best Practices** and **Limitations** to take into consideration when solving the scenario.\nThere will be no discussion about Software Architecture as CTA and Software architecture are 2 different things and often developer have difficulties to distinguish between both concepts.\n## How to contribute\nThis document is open source and you can contribute to it by creating a pull request.";
  }else{
    routeProperties.markdownUrl = `${staticUrl}/Documentation/${requestPath}`;
  }
  //routeProperties.markdownUrl = "https://raw.githubusercontent.com/grebmann1/cta-cheat-sheet/main/Documentation/Documentation.md";
  console.log('routeProperties',routeProperties);
  return {
    // Required: customize the current route by setting:
    // { rootComponent?, contentTemplate?, layoutTemplate? }
    view: {
      //rootComponent: 'ui/markdownViewer',
      contentTemplate: '$contentDir/cta.html',
      layoutTemplate: "$layoutsDir/cta.html",
    },
    // Required: pass context to the templates
    viewParams: {
      message, // pass the "message" path param
      ...routeProperties, // pass the static route properties
    },
    // Optional: rendering options { skipMetadataCollection?, freezeAssets?, skipCaching? }
    renderOptions: {
      freezeAssets: true,
    },
    // Optional: caching options { ttl? }
    cache: {
      ttl: 200,
    },
  };
}