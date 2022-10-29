# An abstract model generator for Uppaal

## Requirements

* antlr4
* nodejs (v14 or newer)
* UppAal (v4.1 or newer)

## About

Current version provides following functionalities:

* generation of a product (as an extended MAS graph),
* lower-/upper-approximation of a local domain of either MAS graph or its template,
* generation of an abstract model based on the mapping function.

For now abstraction parameters must be changed within the code (in `config.js` or `main.js` files), CLI/GUI is coming soon.

Please keep note that this is work in progress.

## Limitations 

Some of the notable limitations are listed below:

* input model must be syntactically correct,
* stucts and custom typedef aliases are not yet supported,
* only 1-dimensional arrays,
* "simple" assignment and guard labels (i.e., not involving function calls),
* handling variable shadowing is not fully tested yet and should be omitted.

