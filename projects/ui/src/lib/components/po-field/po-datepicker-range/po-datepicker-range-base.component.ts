import { ChangeDetectorRef, Directive, EventEmitter, Input, Output } from '@angular/core';
import { AbstractControl, ControlValueAccessor, ValidationErrors, Validator } from '@angular/forms';
import { InputBoolean } from '../../../decorators';
import { poLocaleDefault } from '../../../services/po-language/po-language.constant';
import { PoLanguageService } from '../../../services/po-language/po-language.service';
import { requiredFailed } from '../validators';
import { PoDateService } from './../../../services/po-date/po-date.service';
import { convertIsoToDate, convertToBoolean, setYearFrom0To100, validateDateRange } from './../../../utils/util';
import { PoDatepickerRangeLiterals } from './interfaces/po-datepicker-range-literals.interface';
import { PoDatepickerRange } from './interfaces/po-datepicker-range.interface';
import { poDatepickerRangeLiteralsDefault } from './po-datepicker-range.literals';

/**
 * @description
 *
 * O `po-datepicker-range` é um componente para seleção de um período entre duas datas, onde é possível informar apenas
 * a data inicial ou a data final.
 *
 * O componente `[(ngModel)]` do `po-datepicker-range` trabalha com um objeto que implementa a interface
 * `PoDatepickerRange`, contendo as seguintes propriedades:
 * ```
 * { "start": '2017-11-28', "end": '2017-11-30' }
 * ```
 *
 * <a id="accepted-formats"></a>
 * Este componente pode receber os seguintes formatos de data:
 *
 * - **Data e hora combinados (E8601DZw): yyyy-mm-ddThh:mm:ss+|-hh:mm**
 * ```
 * '2017-11-28T00:00:00-02:00';
 * ```
 *
 * - **Data (E8601DAw.): yyyy-mm-dd**
 * ```
 * '2017-11-28';
 * ```
 *
 * - **JavaScript Date Object:**
 * ```
 * new Date(2017, 10, 28);
 * ```
 *
 * > O componente respeitará o formato passado para o *model* via codificação. Porém, caso seja feita alteração em algum
 * dos valores de data em tela, o componente atribuirá o formato **Data (E8601DAw.): yyyy-mm-dd** ao model.
 *
 * Importante:
 *
 * - Quando preenchidas a data inicial e final, a data inicial deve ser sempre menor ou igual a data final;
 * - Ao passar uma data inválida via codificação, o valor será mantido no *model* e o `input` da tela aparecerá vazio;
 * - Permite trabalhar com as duas datas separadamente através das propriedades `p-start-date` e `p-end-date` no lugar do
 * `[(ngModel)]`, no entanto sem a validação do formulário;
 * - Para a validação do formulário, utilize o `[(ngModel)]`.
 */
@Directive()
export abstract class PoDatepickerRangeBaseComponent implements ControlValueAccessor, Validator {
  /**
   * @optional
   *
   * @description
   *
   * Aplica foco no elemento ao ser iniciado.
   *
   * > Caso mais de um elemento seja configurado com essa propriedade, apenas o último elemento declarado com ela terá o foco.
   *
   * @default `false`
   */
  @Input('p-auto-focus') @InputBoolean() autoFocus: boolean = false;

  /**
   * @optional
   *
   * @description
   *
   * Texto de apoio do campo.
   */
  @Input('p-help') help?: string;

  /**
   * @optional
   *
   * @description
   *
   * Rótulo do campo.
   */
  @Input('p-label') label?: string;

  /**
   * @optional
   *
   * @description
   *
   * Define se a indicação de campo opcional será exibida.
   *
   * > Não será exibida a indicação se:
   * - O campo conter `p-required`;
   * - Não possuir `p-help` e/ou `p-label`.
   *
   * @default `false`
   */
  @Input('p-optional') optional: boolean;

  /**
   * @optional
   *
   * @description
   *
   * Evento disparado ao alterar valor do campo.
   */
  @Output('p-change') onChange: EventEmitter<any> = new EventEmitter<any>();

  errorMessage: string = '';
  dateRange: PoDatepickerRange = { start: '', end: '' };

  protected format: any = 'dd/mm/yyyy';
  protected isDateRangeInputFormatValid: boolean = true;
  protected isStartDateRangeInputValid: boolean = true;
  protected onTouchedModel: any;

  private _clean?: boolean = false;
  private _disabled?;
  private _endDate?;
  private _literals?: any;
  private _maxDate: Date;
  private _minDate: Date;
  private _noAutocomplete?: boolean = false;
  private _readonly: boolean = false;
  private _required?: boolean = false;
  private _startDate?;

  private language;
  private onChangeModel: any;
  private validatorChange: any;

  get isDateRangeInputValid() {
    return this.isDateRangeInputFormatValid && this.isStartDateRangeInputValid;
  }

  /**
   * @optional
   *
   * @description
   *
   * Habilita ação para limpar o campo.
   *
   * @default `false`
   */
  @Input('p-clean') set clean(clean: boolean) {
    this._clean = convertToBoolean(clean);
  }

  get clean() {
    return this._clean;
  }

  /**
   * @optional
   *
   * @description
   *
   * Desabilita o campo.
   *
   * @default `false`
   */
  @Input('p-disabled') set disabled(value: boolean) {
    this._disabled = convertToBoolean(value);

    this.validateModel(this.dateRange);
  }

  get disabled() {
    return this._disabled;
  }

  /**
   * @optional
   *
   * @description
   *
   * Data final.
   */
  @Input('p-end-date') set endDate(date: string | Date) {
    this._endDate = this.convertPatternDateFormat(date);
    this.dateRange.end = this.endDate;

    this.updateScreenByModel(this.dateRange);
    this.updateModel(this.dateRange);
  }

  get endDate() {
    return this._endDate;
  }

  /**
   * @optional
   *
   * @description
   *
   * Objeto com as literais usadas no `po-datepicker-range`.
   *
   * Existem duas maneiras de customizar o componente, passando um objeto com todas as literais disponíveis:
   *
   * ```
   *  const customLiterals: PoDatepickerRangeLiterals = {
   *    invalidFormat: 'Date in inconsistent format',
   *    startDateGreaterThanEndDate: 'End date less than start date'
   *  };
   * ```
   *
   * Ou passando apenas as literais que deseja customizar:
   *
   * ```
   *  const customLiterals: PoDatepickerRangeLiterals = {
   *    invalidFormat: 'Date in inconsistent format'
   *  };
   * ```
   *
   * E para carregar as literais customizadas, basta apenas passar o objeto para o componente.
   *
   * ```
   * <po-datepicker-range
   *   [p-literals]="customLiterals">
   * </po-datepicker-range>
   * ```
   *
   * > O objeto padrão de literais será traduzido de acordo com o idioma do
   * [`PoI18nService`](/documentation/po-i18n) ou do browser.
   */
  @Input('p-literals') set literals(value: PoDatepickerRangeLiterals) {
    if (value instanceof Object && !(value instanceof Array)) {
      this._literals = {
        ...poDatepickerRangeLiteralsDefault[poLocaleDefault],
        ...poDatepickerRangeLiteralsDefault[this.language],
        ...value
      };
    } else {
      this._literals = poDatepickerRangeLiteralsDefault[this.language];
    }
  }

  get literals() {
    return this._literals || poDatepickerRangeLiteralsDefault[this.language];
  }

  /**
   * @optional
   *
   * @description
   *
   * Define uma data mínima para o `po-datepicker-range`.
   */
  @Input('p-min-date') set minDate(value: string | Date) {
    if (value instanceof Date) {
      const year = value.getFullYear();

      const date = new Date(year, value.getMonth(), value.getDate(), 0, 0, 0);
      setYearFrom0To100(date, year);

      this._minDate = date;
    } else {
      this._minDate = convertIsoToDate(value, true, false);
    }
  }

  get minDate() {
    return this._minDate;
  }

  /**
   * @optional
   *
   * @description
   *
   * Define uma data máxima para o `po-datepicker-range`.
   */
  @Input('p-max-date') set maxDate(value: string | Date) {
    if (value instanceof Date) {
      const year = value.getFullYear();

      const date = new Date(year, value.getMonth(), value.getDate(), 23, 59, 59);
      setYearFrom0To100(date, year);

      this._maxDate = date;
    } else {
      this._maxDate = convertIsoToDate(value, false, true);
    }
  }

  get maxDate() {
    return this._maxDate;
  }

  /**
   * @optional
   *
   * @description
   *
   * Define a propriedade nativa `autocomplete` do campo como `off`.
   *
   * @default `false`
   */
  @Input('p-no-autocomplete') set noAutocomplete(value: boolean) {
    this._noAutocomplete = convertToBoolean(value);
  }

  get noAutocomplete() {
    return this._noAutocomplete;
  }

  /**
   * @optional
   *
   * @description
   *
   * Indica que o campo será somente leitura.
   *
   * @default `false`
   */
  @Input('p-readonly') set readonly(value: boolean) {
    this._readonly = convertToBoolean(value);

    this.validateModel(this.dateRange);
  }

  get readonly() {
    return this._readonly;
  }

  /**
   * @optional
   *
   * @description
   *
   * Indica que o campo será obrigatório.
   *
   * @default `false`
   */
  @Input('p-required') set required(required: boolean) {
    this._required = convertToBoolean(required);

    this.validateModel(this.dateRange);
  }

  get required() {
    return this._required;
  }

  /**
   * @optional
   *
   * @description
   *
   * Data inicial.
   */
  @Input('p-start-date') set startDate(date: string | Date) {
    this._startDate = this.convertPatternDateFormat(date);
    this.dateRange.start = this.startDate;

    this.updateScreenByModel(this.dateRange);
    this.updateModel(this.dateRange);
  }

  get startDate() {
    return this._startDate;
  }

  constructor(protected poDateService: PoDateService, languageService: PoLanguageService) {
    this.language = languageService.getShortLanguage();
  }

  // Função implementada do ControlValueAccessor
  // Usada para interceptar os estados de habilitado via forms api
  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
  }

  // Função implementada do ControlValueAccessor
  // Usada para interceptar as mudanças e não atualizar automaticamente o Model
  registerOnChange(func: any): void {
    this.onChangeModel = func;
  }

  // Função implementada do ControlValueAccessor
  // Usada para interceptar as mudanças e não atualizar automaticamente o Model
  registerOnTouched(func: any): void {
    this.onTouchedModel = func;
  }

  registerOnValidatorChange?(fn: () => void): void {
    this.validatorChange = fn;
  }

  validate(control: AbstractControl): ValidationErrors {
    const value: PoDatepickerRange = control.value || {};
    const startDate = value.start ? this.convertPatternDateFormat(value.start) : '';
    const endDate = value.end ? this.convertPatternDateFormat(value.end) : '';

    if (this.requiredDateRangeFailed(startDate, endDate)) {
      this.errorMessage = '';

      return {
        required: {
          valid: false
        }
      };
    }

    if (!this.verifyValidDate(startDate, endDate)) {
      this.errorMessage = this.literals.invalidDate;
      return {
        date: {
          valid: false
        }
      };
    }

    if (this.dateRangeObjectFailed(control.value) || this.dateRangeFormatFailed(startDate, endDate)) {
      this.errorMessage = this.literals.invalidFormat;

      return {
        date: {
          valid: false
        }
      };
    }

    if (this.dateRangeFailed(startDate, endDate)) {
      this.errorMessage = this.literals.startDateGreaterThanEndDate;

      return {
        date: {
          valid: false
        }
      };
    }

    if ((startDate && !this.validateDateInRange(startDate)) || (endDate && !this.validateDateInRange(endDate))) {
      this.errorMessage = this.literals.dateOutOfPeriod;

      return {
        date: {
          valid: false
        }
      };
    }

    return null;
  }

  validateDateInRange(startDate: any): boolean {
    return validateDateRange(convertIsoToDate(startDate, false, false), this._minDate, this._maxDate);
  }

  writeValue(dateRange: PoDatepickerRange): void {
    this.resetDateRangeInputValidation();

    if (!dateRange || this.dateRangeObjectFailed(dateRange)) {
      this.dateRange = { start: '', end: '' };
    }

    if (!dateRange) {
      this.validateModel(this.dateRange);
    }

    if (this.dateRangeObjectFailed(dateRange)) {
      this.updateModel(dateRange);
    }

    if (this.isDateRangeObject(dateRange)) {
      this.dateRange = {
        start: this.convertPatternDateFormat(dateRange.start),
        end: this.convertPatternDateFormat(dateRange.end)
      };

      this.updateModel(this.dateRange);
    }

    this.updateScreenByModel(this.dateRange);
  }

  protected dateFormatFailed(value: string): boolean {
    return value && !this.poDateService.isValidIso(value);
  }

  // Executa a função onChange
  protected updateModel(value: any) {
    const model = typeof value === 'object' ? { ...value } : value;
    // Quando o input não possui um formulário, então esta função não é registrada
    if (this.onChangeModel) {
      this.onChangeModel(model);
    }
  }

  protected validateModel(value: any) {
    const model = { ...value };
    if (this.validatorChange) {
      this.validatorChange(model);
    }
  }

  protected verifyValidDate(startDate: string, endDate: string) {
    if (startDate !== '' && endDate !== '') {
      return this.dateIsValid(startDate) && this.dateIsValid(endDate);
    } else if (startDate !== '') {
      return this.dateIsValid(startDate);
    } else {
      return this.dateIsValid(endDate);
    }
  }

  private convertPatternDateFormat(value: any) {
    if (value instanceof Date) {
      return this.poDateService.convertDateToISO(value);
    }

    return value;
  }

  private dateRangeFailed(startDate: string, endDate: string): boolean {
    return !this.poDateService.isDateRangeValid(endDate, startDate) || !this.isStartDateRangeInputValid;
  }

  private dateRangeFormatFailed(startDate: string, endDate: string): boolean {
    return this.dateFormatFailed(endDate) || this.dateFormatFailed(startDate) || !this.isDateRangeInputFormatValid;
  }

  private dateRangeObjectFailed(value): boolean {
    return value && !this.isDateRangeObject(value);
  }

  private isDateRangeObject(value): boolean {
    return value && value.hasOwnProperty('start') && value.hasOwnProperty('end');
  }

  private requiredDateRangeFailed(startDate: string, endDate: string): boolean {
    return (
      this.isDateRangeInputValid &&
      requiredFailed(this.required, this.disabled, startDate) &&
      requiredFailed(this.required, this.disabled, endDate)
    );
  }

  private dateIsValid(date: string) {
    const [strYear, strMonth, strDay] = date.split('-');
    const year = Number(strYear);
    const month = Number(strMonth);
    const day = Number(strDay);

    //verificação dos meses com 31 dias
    if (month === 1 || month === 3 || month === 5 || month === 7 || month === 8 || month === 10 || month === 12) {
      return day < 1 || day > 31 ? false : true;
    } else if (month === 4 || month === 6 || month === 9 || month === 11) {
      //verificação dos meses com 30 dias
      return day < 1 || day > 30 ? false : true;
    } else {
      //verificacao de ano bissexto para verificar até qual dia irá o mês de fevereiro
      if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
        return day < 1 || day > 29 ? false : true;
      } else {
        return day < 1 || day > 28 ? false : true;
      }
    }
  }

  protected abstract resetDateRangeInputValidation(): void;

  protected abstract updateScreenByModel(dateRange: PoDatepickerRange);
}
