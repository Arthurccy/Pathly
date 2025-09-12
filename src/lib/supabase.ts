import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create a single supabase client for the whole app with explicit auth options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Ensure we use browser storage when available (helps avoid in-memory resets)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Types pour Supabase
export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          balance: number
          currency: string
          color: string
          is_active: boolean
          order_index: number
          bank_name: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: string
          balance: number
          currency: string
          color: string
          is_active?: boolean
          order_index: number
          bank_name?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          balance?: number
          currency?: string
          color?: string
          is_active?: boolean
          order_index?: number
          bank_name?: string | null
          description?: string | null
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          amount: number
          description: string
          date: string
          category_id: string
          type: string
          status: string
          is_recurring: boolean
          recurring_pattern: any | null
          memo: string | null
          tags: string[] | null
          transfer_to_account_id: string | null
          is_checked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          amount: number
          description: string
          date: string
          category_id: string
          type: string
          status?: string
          is_recurring?: boolean
          recurring_pattern?: any | null
          memo?: string | null
          tags?: string[] | null
          transfer_to_account_id?: string | null
          is_checked?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          amount?: number
          description?: string
          date?: string
          category_id?: string
          type?: string
          status?: string
          is_recurring?: boolean
          recurring_pattern?: any | null
          memo?: string | null
          tags?: string[] | null
          transfer_to_account_id?: string | null
          is_checked?: boolean
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string
          color: string
          type: string
          parent_id: string | null
          order_index: number
          is_active: boolean
          budget: number | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon: string
          color: string
          type: string
          parent_id?: string | null
          order_index: number
          is_active?: boolean
          budget?: number | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string
          color?: string
          type?: string
          parent_id?: string | null
          order_index?: number
          is_active?: boolean
          budget?: number | null
          description?: string | null
          updated_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          target_amount: number
          current_amount: number
          deadline: string | null
          category_id: string | null
          account_id: string | null
          priority: string
          is_completed: boolean
          color: string | null
          auto_contribution: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          target_amount: number
          current_amount?: number
          deadline?: string | null
          category_id?: string | null
          account_id?: string | null
          priority: string
          is_completed?: boolean
          color?: string | null
          auto_contribution?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          target_amount?: number
          current_amount?: number
          deadline?: string | null
          category_id?: string | null
          account_id?: string | null
          priority?: string
          is_completed?: boolean
          color?: string | null
          auto_contribution?: any | null
          updated_at?: string
        }
      }
      debts: {
        Row: {
          id: string
          user_id: string
          name: string
          total_amount: number
          remaining_amount: number
          interest_rate: number
          minimum_payment: number
          due_date: string
          account_id: string
          category_id: string | null
          type: string
          is_active: boolean
          creditor: string | null
          description: string | null
          payment_day: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          total_amount: number
          remaining_amount: number
          interest_rate: number
          minimum_payment: number
          due_date: string
          account_id: string
          category_id?: string | null
          type: string
          is_active?: boolean
          creditor?: string | null
          description?: string | null
          payment_day?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          total_amount?: number
          remaining_amount?: number
          interest_rate?: number
          minimum_payment?: number
          due_date?: string
          account_id?: string
          category_id?: string | null
          type?: string
          is_active?: boolean
          creditor?: string | null
          description?: string | null
          payment_day?: number | null
          updated_at?: string
        }
      }
      debt_payments: {
        Row: {
          id: string
          debt_id: string
          amount: number
          date: string
          principal: number
          interest: number
          transaction_id: string | null
          payment_method: string | null
          created_at: string
        }
        Insert: {
          id?: string
          debt_id: string
          amount: number
          date: string
          principal: number
          interest: number
          transaction_id?: string | null
          payment_method?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          debt_id?: string
          amount?: number
          date?: string
          principal?: number
          interest?: number
          transaction_id?: string | null
          payment_method?: string | null
        }
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string
          amount: number
          period: string
          start_date: string
          end_date: string | null
          is_active: boolean
          alert_threshold: number | null
          rollover: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          amount: number
          period: string
          start_date: string
          end_date?: string | null
          is_active?: boolean
          alert_threshold?: number | null
          rollover?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          amount?: number
          period?: string
          start_date?: string
          end_date?: string | null
          is_active?: boolean
          alert_threshold?: number | null
          rollover?: boolean
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          fiscal_year_start: number
          default_period: string
          currency: string
          date_format: string
          theme: string
          language: string
          notifications: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          fiscal_year_start?: number
          default_period?: string
          currency?: string
          date_format?: string
          theme?: string
          language?: string
          notifications?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          fiscal_year_start?: number
          default_period?: string
          currency?: string
          date_format?: string
          theme?: string
          language?: string
          notifications?: any
          updated_at?: string
        }
      }
    }
  }
}
