interface ApiValidationError {
   detail: {
      loc: (string | number)[];
      msg: string;
      type: string;
   }[];
}

interface ApiError {
   detail: string;
}