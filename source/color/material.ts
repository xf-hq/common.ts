// https://material.io/design/color/the-color-system.html#tools-for-picking-colors

import { isObject } from '../general/type-checking';
import { StaticColor } from './static-color';

export type Material =
  Material.Red |
  Material.Pink |
  Material.Purple |
  Material.DeepPurple |
  Material.Indigo |
  Material.Blue |
  Material.LightBlue |
  Material.Cyan |
  Material.Teal |
  Material.Green |
  Material.LightGreen |
  Material.Lime |
  Material.Yellow |
  Material.Amber |
  Material.Orange |
  Material.DeepOrange |
  Material.Brown |
  Material.Gray |
  Material.BlueGray;

const _colorName_ = Symbol.for('Material.colorName');
export const isMaterialColorGroup = (o: any): o is Material => isObject(o) && _colorName_ in o;
export const isMaterialColorName = <K extends keyof Material.Namespace> (string: K | string): string is K => string in Material;
export const isMaterialColorShade = <K extends keyof Material.Namespace, S extends keyof Material.Namespace[K], U> (group: K, shade: S | U): shade is S => (shade as S) in Material[group];
export const getMaterialColorName = (o: Material): keyof Material.Namespace => o[_colorName_];
export function getMaterialColorValue<K extends keyof Material.Namespace> (name: K, shade?: keyof Material.Namespace[K]): string;
export function getMaterialColorValue<K extends keyof Material.Namespace> (name: K, shade?: any): string {
  const group = Material[name];
  return shade ? group[shade] : group[500];
}
export const getMaterialColorGroup = <K extends keyof Material.Namespace> (name: K): Material.Namespace[K] => Material[name];
export namespace Material {
  export type Namespace = typeof Material;

  export type Red = typeof red;
  export const red = {
    50: '#ffebee' as const,
    100: '#ffcdd2' as const,
    200: '#ef9a9a' as const,
    300: '#e57373' as const,
    400: '#ef5350' as const,
    500: '#f44336' as const,
    600: '#e53935' as const,
    700: '#d32f2f' as const,
    800: '#c62828' as const,
    900: '#b71c1c' as const,
    'A100': '#ff8a80' as const,
    'A200': '#ff5252' as const,
    'A400': '#ff1744' as const,
    'A700': '#d50000' as const,
  };
  Object.defineProperties(red, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'red' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => red[500] },
  });
}
export namespace Material {
  export type Pink = typeof pink;
  export const pink = {
    50: '#fce4ec' as const,
    100: '#f8bbd0' as const,
    200: '#f48fb1' as const,
    300: '#f06292' as const,
    400: '#ec407a' as const,
    500: '#e91e63' as const,
    600: '#d81b60' as const,
    700: '#c2185b' as const,
    800: '#ad1457' as const,
    900: '#880e4f' as const,
    'A100': '#ff80ab' as const,
    'A200': '#ff4081' as const,
    'A400': '#f50057' as const,
    'A700': '#c51162' as const,
  };
  Object.defineProperties(pink, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'pink' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => pink[500] },
  });
}
export namespace Material {
  export type Purple = typeof purple;
  export const purple = {
    50: '#f3e5f5' as const,
    100: '#e1bee7' as const,
    200: '#ce93d8' as const,
    300: '#ba68c8' as const,
    400: '#ab47bc' as const,
    500: '#9c27b0' as const,
    600: '#8e24aa' as const,
    700: '#7b1fa2' as const,
    800: '#6a1b9a' as const,
    900: '#4a148c' as const,
    'A100': '#ea80fc' as const,
    'A200': '#e040fb' as const,
    'A400': '#d500f9' as const,
    'A700': '#aa00ff' as const,
  };
  Object.defineProperties(purple, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'purple' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => purple[500] },
  });
}
export namespace Material {
  export type DeepPurple = typeof deepPurple;
  export const deepPurple = {
    50: '#ede7f6' as const,
    100: '#d1c4e9' as const,
    200: '#b39ddb' as const,
    300: '#9575cd' as const,
    400: '#7e57c2' as const,
    500: '#673ab7' as const,
    600: '#5e35b1' as const,
    700: '#512da8' as const,
    800: '#4527a0' as const,
    900: '#311b92' as const,
    'A100': '#b388ff' as const,
    'A200': '#7c4dff' as const,
    'A400': '#651fff' as const,
    'A700': '#6200ea' as const,
  };
  Object.defineProperties(deepPurple, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'deepPurple' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => deepPurple[500] },
  });
}
export namespace Material {
  export type Indigo = typeof indigo;
  export const indigo = {
    50: '#e8eaf6' as const,
    100: '#c5cae9' as const,
    200: '#9fa8da' as const,
    300: '#7986cb' as const,
    400: '#5c6bc0' as const,
    500: '#3f51b5' as const,
    600: '#3949ab' as const,
    700: '#303f9f' as const,
    800: '#283593' as const,
    900: '#1a237e' as const,
    'A100': '#8c9eff' as const,
    'A200': '#536dfe' as const,
    'A400': '#3d5afe' as const,
    'A700': '#304ffe' as const,
  };
  Object.defineProperties(indigo, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'indigo' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => indigo[500] },
  });
}
export namespace Material {
  export type Blue = typeof blue;
  export const blue = {
    50: '#e3f2fd' as const,
    100: '#bbdefb' as const,
    200: '#90caf9' as const,
    300: '#64b5f6' as const,
    400: '#42a5f5' as const,
    500: '#2196f3' as const,
    600: '#1e88e5' as const,
    700: '#1976d2' as const,
    800: '#1565c0' as const,
    900: '#0d47a1' as const,
    'A100': '#82b1ff' as const,
    'A200': '#448aff' as const,
    'A400': '#2979ff' as const,
    'A700': '#2962ff' as const,
  };
  Object.defineProperties(blue, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'blue' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => blue[500] },
  });
}
export namespace Material {
  export type LightBlue = typeof lightBlue;
  export const lightBlue = {
    50: '#e1f5fe' as const,
    100: '#b3e5fc' as const,
    200: '#81d4fa' as const,
    300: '#4fc3f7' as const,
    400: '#29b6f6' as const,
    500: '#03a9f4' as const,
    600: '#039be5' as const,
    700: '#0288d1' as const,
    800: '#0277bd' as const,
    900: '#01579b' as const,
    'A100': '#80d8ff' as const,
    'A200': '#40c4ff' as const,
    'A400': '#00b0ff' as const,
    'A700': '#0091ea' as const,
  };
  Object.defineProperties(lightBlue, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'lightBlue' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => lightBlue[500] },
  });
}
export namespace Material {
  export type Cyan = typeof cyan;
  export const cyan = {
    50: '#e0f7fa' as const,
    100: '#b2ebf2' as const,
    200: '#80deea' as const,
    300: '#4dd0e1' as const,
    400: '#26c6da' as const,
    500: '#00bcd4' as const,
    600: '#00acc1' as const,
    700: '#0097a7' as const,
    800: '#00838f' as const,
    900: '#006064' as const,
    'A100': '#84ffff' as const,
    'A200': '#18ffff' as const,
    'A400': '#00e5ff' as const,
    'A700': '#00b8d4' as const,
  };
  Object.defineProperties(cyan, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'cyan' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => cyan[500] },
  });
}
export namespace Material {
  export type Teal = typeof teal;
  export const teal = {
    50: '#e0f2f1' as const,
    100: '#b2dfdb' as const,
    200: '#80cbc4' as const,
    300: '#4db6ac' as const,
    400: '#26a69a' as const,
    500: '#009688' as const,
    600: '#00897b' as const,
    700: '#00796b' as const,
    800: '#00695c' as const,
    900: '#004d40' as const,
    'A100': '#a7ffeb' as const,
    'A200': '#64ffda' as const,
    'A400': '#1de9b6' as const,
    'A700': '#00bfa5' as const,
  };
  Object.defineProperties(teal, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'teal' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => teal[500] },
  });
}
export namespace Material {
  export type Green = typeof green;
  export const green = {
    50: '#e8f5e9' as const,
    100: '#c8e6c9' as const,
    200: '#a5d6a7' as const,
    300: '#81c784' as const,
    400: '#66bb6a' as const,
    500: '#4caf50' as const,
    600: '#43a047' as const,
    700: '#388e3c' as const,
    800: '#2e7d32' as const,
    900: '#1b5e20' as const,
    'A100': '#b9f6ca' as const,
    'A200': '#69f0ae' as const,
    'A400': '#00e676' as const,
    'A700': '#00c853' as const,
  };
  Object.defineProperties(green, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'green' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => green[500] },
  });
}
export namespace Material {
  export type LightGreen = typeof lightGreen;
  export const lightGreen = {
    50: '#f1f8e9' as const,
    100: '#dcedc8' as const,
    200: '#c5e1a5' as const,
    300: '#aed581' as const,
    400: '#9ccc65' as const,
    500: '#8bc34a' as const,
    600: '#7cb342' as const,
    700: '#689f38' as const,
    800: '#558b2f' as const,
    900: '#33691e' as const,
    'A100': '#ccff90' as const,
    'A200': '#b2ff59' as const,
    'A400': '#76ff03' as const,
    'A700': '#64dd17' as const,
  };
  Object.defineProperties(lightGreen, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'lightGreen' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => lightGreen[500] },
  });
}
export namespace Material {
  export type Lime = typeof lime;
  export const lime = {
    50: '#f9fbe7' as const,
    100: '#f0f4c3' as const,
    200: '#e6ee9c' as const,
    300: '#dce775' as const,
    400: '#d4e157' as const,
    500: '#cddc39' as const,
    600: '#c0ca33' as const,
    700: '#afb42b' as const,
    800: '#9e9d24' as const,
    900: '#827717' as const,
    'A100': '#f4ff81' as const,
    'A200': '#eeff41' as const,
    'A400': '#c6ff00' as const,
    'A700': '#aeea00' as const,
  };
  Object.defineProperties(lime, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'lime' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => lime[500] },
  });
}
export namespace Material {
  export type Yellow = typeof yellow;
  export const yellow = {
    50: '#fffde7' as const,
    100: '#fff9c4' as const,
    200: '#fff59d' as const,
    300: '#fff176' as const,
    400: '#ffee58' as const,
    500: '#ffeb3b' as const,
    600: '#fdd835' as const,
    700: '#fbc02d' as const,
    800: '#f9a825' as const,
    900: '#f57f17' as const,
    'A100': '#ffff8d' as const,
    'A200': '#ffff00' as const,
    'A400': '#ffea00' as const,
    'A700': '#ffd600' as const,
  };
  Object.defineProperties(yellow, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'yellow' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => yellow[500] },
  });
}
export namespace Material {
  export type Amber = typeof amber;
  export const amber = {
    50: '#fff8e1' as const,
    100: '#ffecb3' as const,
    200: '#ffe082' as const,
    300: '#ffd54f' as const,
    400: '#ffca28' as const,
    500: '#ffc107' as const,
    600: '#ffb300' as const,
    700: '#ffa000' as const,
    800: '#ff8f00' as const,
    900: '#ff6f00' as const,
    'A100': '#ffe57f' as const,
    'A200': '#ffd740' as const,
    'A400': '#ffc400' as const,
    'A700': '#ffab00' as const,
  };
  Object.defineProperties(amber, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'amber' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => amber[500] },
  });
}
export namespace Material {
  export type Orange = typeof orange;
  export const orange = {
    50: '#fff3e0' as const,
    100: '#ffe0b2' as const,
    200: '#ffcc80' as const,
    300: '#ffb74d' as const,
    400: '#ffa726' as const,
    500: '#ff9800' as const,
    600: '#fb8c00' as const,
    700: '#f57c00' as const,
    800: '#ef6c00' as const,
    900: '#e65100' as const,
    'A100': '#ffd180' as const,
    'A200': '#ffab40' as const,
    'A400': '#ff9100' as const,
    'A700': '#ff6d00' as const,
  };
  Object.defineProperties(orange, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'orange' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => orange[500] },
  });
}
export namespace Material {
  export type DeepOrange = typeof deepOrange;
  export const deepOrange = {
    50: '#fbe9e7' as const,
    100: '#ffccbc' as const,
    200: '#ffab91' as const,
    300: '#ff8a65' as const,
    400: '#ff7043' as const,
    500: '#ff5722' as const,
    600: '#f4511e' as const,
    700: '#e64a19' as const,
    800: '#d84315' as const,
    900: '#bf360c' as const,
    'A100': '#ff9e80' as const,
    'A200': '#ff6e40' as const,
    'A400': '#ff3d00' as const,
    'A700': '#dd2c00' as const,
  };
  Object.defineProperties(deepOrange, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'deepOrange' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => deepOrange[500] },
  });
}
export namespace Material {
  export type Brown = typeof brown;
  export const brown = {
    50: '#efebe9' as const,
    100: '#d7ccc8' as const,
    200: '#bcaaa4' as const,
    300: '#a1887f' as const,
    400: '#8d6e63' as const,
    500: '#795548' as const,
    600: '#6d4c41' as const,
    700: '#5d4037' as const,
    800: '#4e342e' as const,
    900: '#3e2723' as const,
  };
  Object.defineProperties(brown, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'brown' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => brown[500] },
  });
}
export namespace Material {
  export type Gray = typeof gray;
  export const gray = {
    50: '#fafafa' as const,
    100: '#f5f5f5' as const,
    200: '#eeeeee' as const,
    300: '#e0e0e0' as const,
    400: '#bdbdbd' as const,
    500: '#9e9e9e' as const,
    600: '#757575' as const,
    700: '#616161' as const,
    750: '#525252' as const,
    800: '#424242' as const,
    850: '#323232' as const,
    900: '#212121' as const,
  };
  Object.defineProperties(gray, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'gray' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => gray[500] },
  });
}
export namespace Material {
  export type BlueGray = typeof blueGray;
  export const blueGray = {
    50: '#eceff1' as const,
    100: '#cfd8dc' as const,
    200: '#b0bec5' as const,
    300: '#90a4ae' as const,
    400: '#78909c' as const,
    500: '#607d8b' as const,
    600: '#546e7a' as const,
    700: '#455a64' as const,
    800: '#37474f' as const,
    900: '#263238' as const,
  };
  Object.defineProperties(blueGray, {
    [_colorName_]: { configurable: true, enumerable: false, writable: false, value: 'blueGray' },
    toString: { configurable: true, enumerable: false, writable: false, value: () => blueGray[500] },
  });
}

export type MaterialSC = MaterialSC.Namespace[keyof MaterialSC.Namespace];
export const MaterialSC = new Proxy<MaterialSC.Namespace>({} as any, {
  get (t, p) {
    if (p in t) return t[p];
    const group = Material[p];
    if (!isMaterialColorGroup(group)) return undefined;
    const groupsc: MaterialSC.Group<any> = {} as any;
    Object.defineProperties(groupsc, {
      toString: { configurable: true, enumerable: false, writable: false, value: () => group[500] },
    });
    return t[p] = new Proxy(groupsc, {
      has (t, p) {
        switch (p) {
          case _colorName_:
          case 'toString':
            return true;
          default:
            return p in t;
        }
      },
      get (t, p: any, r) {
        if (p in t) return t[p];
        switch (p) {
          case _colorName_: return group[_colorName_];
          case 'toString': return Reflect.get(t, 'toString', r);
          default: if (p in groupsc) return Reflect.get(t, p, r);
        }
        if (!(p in group)) return undefined;
        return t[p] = StaticColor.fromHex(group[p] as string);
      },
    });
  },
});
export namespace MaterialSC {
  export type Namespace = { [K in keyof Material.Namespace]: Group<K> };
  export type Group<K extends keyof Material.Namespace> = { [S in keyof Material.Namespace[K]]: StaticColor };
}
