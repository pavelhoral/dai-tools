# DAI L10N Tools

Pro fungování skriptů je nutné mít [NodeJS](https://nodejs.org/en/download/) a ideálně spouštět z [Git Bashe](https://gitforwindows.org/).

### Export celku

    EXPORT_BASE=../doplnit
    ./extract.js "$EXPORT_BASE" > export.csv

### Export podadresářů

    EXPORT_BASE=../doplnit
    for f in $(ls -d $EXPORT_BASE/*/); do ./extract.js $EXPORT_BASE/$(basename $f) > $(basename $f).csv ; done
