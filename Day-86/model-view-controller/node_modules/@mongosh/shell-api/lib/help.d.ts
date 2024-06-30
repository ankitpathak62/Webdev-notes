import { shellApiType, asPrintable } from './enums';
type HelpPropertiesAttr = {
    name?: string;
    description: string;
};
export type HelpProperties = {
    help: string;
    docs?: string;
    attr?: HelpPropertiesAttr[];
};
type HelpOptions = {
    translate(key: string): string | undefined;
};
export default class Help {
    private help;
    private docs;
    private attr;
    constructor(properties: HelpProperties, options?: HelpOptions);
    [asPrintable](): HelpProperties;
    get [shellApiType](): string;
}
export {};
