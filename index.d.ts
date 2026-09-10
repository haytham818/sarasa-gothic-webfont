export interface SarasaFont {
  readonly className: string;
  readonly variable: string;
  readonly style: Readonly<{
    fontFamily: string;
  }>;
}

export declare function Sarasa_UI_SC(): SarasaFont;
